
function LineChart(source, root, options) {
  // options
  options = options || {}
  var margin = options.margin || { top: 8, right: 24, bottom: 64, left: 40 };
  var padding = options.padding || 0.05;
  var xProp = options.xProp || "week_date"
  var yProp = options.yProp || "week_diff"
  var yAxisFormat = options.yAxisFormat || ",.0%"
  var xAxisFormat = options.xAxisFormat || "%b %d"
  
  // formatters, parsers, helper functions
  var xFormat = "%b %d";
  var parseTime = d3.timeParse("%d/%m/%Y");
  var formatDate = d3.timeFormat("%B %e, %Y");
  var formatNumber = d3.format(yAxisFormat)
  var bisectDate = d3.bisector(function (d) { return d.x }).right

  function initElements(el) {
    return {
      root: el,
      area: el.append("rect")
        .attr("class", "chart__area"),
      markLines: el.append("g").attr("class", "chart__mark-lines"),
      yAxis: el.append('g')
        .attr("class", "chart__axis chart__axis--y"),
      xAxis: el.append('g')
        .attr("class", "chart__axis chart__axis--x"),
      lines: el.append('g').attr("class", "chart__lines"),
      frame: el.append("rect")
        .attr("class", "chart__box"),
      hoverLine: el.append('line').attr('class', 'chart__marker-line'),
      hoverArea: el.append('rect'),
      tooltip: d3.select('#tooltip').attr('class', 'chart__tooltip')
    }
  }

  function padExtent(xtnt) {
    var range = xtnt[1] - xtnt[0]
    var pad = padding * range
    return [xtnt[0], xtnt[1] + pad]
  }

  function parseFilingsCSV(data) {
    var areaStart = data[0]['start_of_moratorium']
      ? parseTime(data[0]['start_of_moratorium'])
      : parseTime("19/03/2020")
    var items = [{
      name: "This Year",
      idx: 0,
      data: data.map(function (d, i) {
        return {
          x: parseTime(d["week_date"]),
          y: parseFloat(d["week_filings"])
        }
      })
    }, {
      name: "Average",
      idx: 1,
      data: data.map(function (d, i) {
        return {
          x: parseTime(d["week_date"]),
          y: parseFloat(d["avg_filings"])
        }
      })
    }
    ]
    var xExtent = d3.extent(data, function (d) { return parseTime(d[xProp]) })
    var yExtent1 = d3.extent(data, function (d) { return parseFloat(d['avg_filings']) })
    var yExtent2 = d3.extent(data, function (d) { return parseFloat(d['week_filings']) })
    var yExtent = [Math.min(yExtent1[0], yExtent2[0]), Math.max(yExtent1[1], yExtent2[1])]
    return {
      xExtent: xExtent,
      yExtent: padExtent(yExtent),
      items: items,
      areaStart: areaStart,
      areaEnd: d3.min([xExtent[1], parseTime(data[0]['end_of_moratorium'])])
    }
  }

  function parseRaceCSV(data) {
    var areaStart = data[0]['start_of_moratorium']
      ? parseTime(data[0]['start_of_moratorium'])
      : parseTime("19/03/2020")
    var dataByGroup = data.reduce(function (result, line) {
      if (!result.hasOwnProperty(line.group))
        result[line.group] = []
      result[line.group].push({
        x: parseTime(line[xProp]),
        y: parseFloat(line[yProp])
      })
      return result
    }, {})
    var items = Object.keys(dataByGroup).map(function (key, i) {
      return {
        name: key,
        data: dataByGroup[key],
        idx: i
      }
    })
    var xExtent = d3.extent(data, function (d) { return parseTime(d[xProp]) })
    var yExtent = d3.extent(data, function (d) { return parseFloat(d[yProp]) })
    return {
      xExtent: xExtent,
      yExtent: padExtent(yExtent),
      items: items,
      areaStart: parseTime("19/03/2020"),
      areaEnd: d3.min([xExtent[1], parseTime(data[0]['end_of_moratorium'])])
    }
  }


  function renderTooltip(items, els, event) {

    var flipped = (d3.event.pageX > (window.innerWidth - 320))
    var space = flipped ? -32 : 32;

    items.sort(function (a, b) {
      return b.data[event.x.index].y - a.data[event.x.index].y;
    })

    els.hoverLine
      .attr('class', 'chart__marker-line chart__marker-line--hover')
      .attr('style', `transform: translateX(${event.x.position}px)`)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', event.height);

    els.tooltip
      .attr('class', 'chart__tooltip' + (flipped ? ' chart__tooltip--flip' : ''))
      .html('<h1>' + formatDate(event.x.value) + '</h1>')
      .style('display', 'block')
      .style('left', d3.event.pageX + space + 'px')
      .style('top', d3.event.pageY + 32 + 'px')
      .selectAll()
      .data(items).enter()
      .append('div')
      .attr('class', function (d) { return 'chart__tooltip-row chart__tooltip-row--' + d.idx })
      .html(function (d) { return '<span>' + d.name + ':</span> ' + formatNumber(d.data[event.x.index].y) });
  }

  function renderGraph(data, els) {
    
    var rect = els.root.node().parentNode.getBoundingClientRect()
    var width = rect.width - margin.left - margin.right;
    var height = rect.height - margin.top - margin.bottom;

    // setup scales
    var x = d3.scaleTime().rangeRound([0, width]).domain(data.xExtent);
    var y = d3.scaleLinear().rangeRound([height, 0]).domain(data.yExtent);

    var markLineData = []
    if (data.areaStart > data.xExtent[0] && data.areaStart < data.xExtent[1])
      markLineData.push({ point: data.areaStart, line1: 'start of', line2: 'moratorium' })
    if (data.areaEnd > data.xExtent[0] && data.areaEnd < data.xExtent[1])
      markLineData.push({ point: data.areaEnd, line1: 'end of', line2: 'moratorium' })
  

    // Define the scales and tell D3 how to draw the line
    const line = d3.line()
      .x(function (d) { return x(d.x) })
      .y(function (d) { return y(d.y) });

    // Add the axes and a title
    var xTicks = width > 420 ? d3.timeWeek.every(2) : d3.timeWeek.every(3)
    var xAxis = d3.axisBottom(x).ticks(xTicks).tickFormat(d3.timeFormat(xFormat));
    var yAxis = d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(formatNumber);

    var handleHover = function () {
      var xHovered = x.invert(d3.mouse(els.hoverArea.node())[0]);
      var set1 = data.items[0].data
      var dataIndex = bisectDate(set1, xHovered);
      var xNext = set1[dataIndex].x
      var xPrev = set1[dataIndex - 1].x
      var xSnapped =
        Math.abs(xHovered.getTime() - xPrev.getTime()) >
          Math.abs(xHovered.getTime() - xNext.getTime())
          ? xNext : xPrev
      var xIndex = xSnapped === xNext ? dataIndex : dataIndex - 1
      var event = {
        width: width,
        height: height,
        x: {
          position: x(xSnapped),
          value: xSnapped,
          index: xIndex
        }
      }
      renderTooltip(data.items, els, event)
    }

    var handleHoverOut = function () {
      if (els.tooltip) els.tooltip.style('display', 'none');
      if (els.hoverLine) els.hoverLine.attr('class', 'chart__marker-line');
    }

    els.root.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

    // y axis
    els.yAxis
      .transition()
      .duration(1000)
      .call(yAxis);

    // x axis
    els.xAxis
      .attr('transform', 'translate(0,' + height + ')')
      .transition()
      .duration(1000)
      .call(xAxis);

    // add moratorium area rect
    els.area
      .attr("x", x(data.areaStart))
      .attr("y", 0)
      .attr("width", x(data.areaEnd) - x(data.areaStart))
      .attr("height", height)

    // lines
    var lines = els.lines.selectAll(".chart__line")
      .data(data.items);

    lines
      .enter()
      .append('path')
      .attr('class', function (d, i) { return 'chart__line chart__line--' + d.idx })
      .merge(lines)
      .datum(d => d.data)
      .transition()
      .duration(1000)
      .attr('d', line);

    // add bounding rect border
    els.frame
      .attr("x", -1)
      .attr("y", 0)
      .attr("width", width + 1)
      .attr("height", height + 1)

    var markLine = els.markLines.selectAll(".chart__mark-line")
      .data(markLineData)
      
    // add moratorium lines
    markLine
      .enter()
      .append('line')
      .attr('class', 'chart__mark-line')
      .merge(markLine)
      .attr('x1', d => x(d.point))
      .attr('x2', d => x(d.point))
      .attr('y1', 0)
      .attr('y2', height + 32)
    
    var markLabel = els.markLines.selectAll(".chart__mark-label")
      .data(markLineData)
      
    // add moratorium lines
    markLabel
      .enter()
      .append('text')
      .attr('class', 'chart__mark-label')
      .merge(markLabel)
      .html(function(d) { 
        return  '<tspan text-anchor="middle" dx="0">' + d.line1 + '</tspan>' + 
                '<tspan text-anchor="middle" dx="-52" dy="16">' + d.line2 + '</tspan>' 
      })
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('x', x(data.areaStart))
      .attr('y', height + 44);

    els.hoverArea
      .attr('width', width)
      .attr('height', height)
      .attr('opacity', 0)
      .on('mousemove', handleHover)
      .on('mouseout', handleHoverOut)
  }

  var parser = source[0].hasOwnProperty('group')
    ? parseRaceCSV
    : parseFilingsCSV
  var data = parser(source)
  console.log(data)
  var els = initElements(root)
  renderGraph(data, els)

  return {
    root: root,
    render: function () { renderGraph(data, els) }
  }
}