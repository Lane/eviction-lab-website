// TYPE DEFINITIONS


function DataItem() {
  return {
    id: "",
    idx: 0,
    name: "",
    data: [{x: 0, y: 0, extra: {}}]
  }
}

function TooltipItem() {
  return {
    idx: 0,
    name: "",
    value: 0
  }
}

function GroupItems() {
  return {
    id: 'group',
    data: [
      { id: '', idx: 0, value: {x: 0, y: 0, extra: {}}}
    ]
  }
}

function ChartConfig() {
  return {
    groupType: "",
    markLines: [],
    data: { 
      area: ["", ""],
      x: "", 
      y: {
        cols: [""]
      }, 
      extra: [""] 
    },
    parse: { 
      x: function() {}, 
      y: function() {}, 
      label: function() {} 
    }
  }
}

function ChartData() {
  return {
    items: [ DataItem() ],
    extents: [[0, 1], [0, 1]],
    area: [0, 1],
    markArea: [0, 1]
  }
}

// END TYPE DEFINITIONS

/**
 * Pulls the extent of the selector from a collection
 * of DataItem objects
 * @param {Array<DataItem>} collection 
 * @param {function} selector 
 * @returns {Array} [min, max]
 */
function getExtentForCollection(collection, selector) {
  return collection.reduce(function(extent, item) {
    const itemExtent = d3.extent(item.data, selector)
    return [ 
      Math.min(itemExtent[0], extent[0]), 
      Math.max(itemExtent[1], extent[1])
    ]
  }, [Number.MAX_VALUE,-Number.MAX_VALUE])
}

/**
 * Populates a parse config with any defaults
 * @param {ChartConfig} config 
 * @returns {ChartConfig}
 */
function makeParseConfig(config) {
  config = config || {};
  config.extent = config.extent || {}
  config.extent.xPad = config.extent.xPad || function(x) { return x }
  config.extent.yPad = config.extent.yPad || function(y) { return y }
  return config
}

/**
 * Gets the area to mark (x start to x end) 
 * @param {*} data 
 * @param {ChartConfig} config 
 */
function parseArea(data, config) {
  return [
    config.parse.area(data[0][config.data.area[0]]),
    config.parse.area(data[0][config.data.area[1]])
  ]
}

/**
 * Parses csv data where group data is organized by column
 * @param {*} data 
 * @param {ChartConfig} config 
 */
function parseColumnItems(data, config) {
  return config.data.y.cols.map(function(col, i) {
    return {
      id: col,
      idx: i,
      name: config.format.label(col),
      data: data.map(function (d, i) {
        return {
          // add x, y pair
          x: config.parse.x(d[config.data.x]),
          y: config.parse.y(d[col]),
          // add extra columns to data
          extras: config.data.extra.reduce(function(obj, colName) { 
            obj[colName] = config.parse[colName] 
              ? config.parse[colName](d[colName]) 
              : d[colName]
            return obj
          }, {})
        }
      })
    }
  })
}

/**
 * Parses csv data where group data is organized by row
 * @param {*} data 
 * @param {ChartConfig} config 
 */
function parseRowItems(data, config) {
  var groupCol = config.data.y.groupBy
  var dataByGroup = data.reduce(function (result, row) {
    if (!result.hasOwnProperty(row[groupCol]))
      result[row[groupCol]] = []
    result[row[groupCol]].push({
      x: config.parse.x(row[config.data.x]),
      y: config.parse.y(row[config.data.y.col]),
      // add extra columns to data
      extras: config.data.extra.reduce(function(obj, colName) { 
        obj[colName] = config.parse[colName] 
          ? config.parse[colName](row[colName]) 
          : row[colName]
        return obj
      }, {})
    })
    return result
  }, {})
  return Object.keys(dataByGroup).map(function (key, i) {
    return {
      id: key,
      idx: i,
      name: config.format.label(key),
      data: dataByGroup[key]
    }
  })
}

/**
 * Parse DataItems and pull the x and y extents
 * @param {*} items 
 * @param {ChartConfig} config 
 */
function parseExtents(items, config) {
  // calculate x and y [min, max] pairs
  var xExtent = getExtentForCollection(items, function(d) { return d.x })
  var yExtent = getExtentForCollection(items, function(d) { return d.y })
  // x and y [min, max], padded based on config value
  return [
    config.extent.xPad(xExtent),
    config.extent.yPad(yExtent)
  ]
}

/**
 * Parses data based on the provided config
 * @param {*} data json to parse
 * @param {ChartConfig} config parse configuration
 * @returns {ChartData}
 */
function parseData(data, config) {
  var result = { _raw: data }
  // process config, add default values
  config = makeParseConfig(config)
  // grab data points for each of the groups
  var itemParser = config.groupType === 'col' 
    ? parseColumnItems 
    : parseRowItems
  result['items'] = itemParser(data, config)
  // x and y [min, max], padded based on config value
  result['extents'] = parseExtents(result['items'], config)
  // parse the area to mark
  if (config.data.area) {
    result['area'] = parseArea(data, config)
    result['markArea'] = [
      result['area'][0],
      d3.min([result['extents'][0][1], result['area'][1]]) // clip mark area
    ]
  }
  return result
}



/**
 * Groups items by a given selector
 * @param {Array<DataItem>} items 
 * @param {function} selector returns an item value to group by
 * @returns {GroupItems}
 */
function groupItems(items, selector) {
  const xValues = items.reduce(function(values, item, i) {
    item.data.forEach(function (d) {
      var value = selector(d)
      if (values.indexOf(value) === -1) values.push(value)
    })
    return values
  }, [])
  return xValues.map(function (value) {
    return {
      id: value,
      data: items.map(function(item, i) {
        return {
          id: item.id,
          idx: item.idx || i,
          value: item.data.find(function(d) { 
            return selector(d) === value 
          })
        }
      })
    }
  })
}

function LineChart(source, root, config) {

  // options
  config = config || {}
  var margin = config.margin || { top: 8, right: 24, bottom: 40, left: 40 };
  var parsedData;
  var elements;
  var chartConfig;

  function getHoverItem(item, i) {
    return {
      idx: i,
      name: chartConfig.format.label(item.id),
      value: chartConfig.format.yTooltip(item.value.y),
      _raw: item.value
    }
  }

  /**
   * Scaffolds all of the required elements to render the chart
   * @param {DOMElement} el root element
   */
  function initElements(el) {
    return {
      root: el,
      area: el.append("rect")
        .attr("class", "chart__area"),
      
      yAxis: el.append('g')
        .attr("class", "chart__axis chart__axis--y"),
      xAxis: el.append('g')
        .attr("class", "chart__axis chart__axis--x"),
      markLines: el.append("g").attr("class", "chart__mark-lines"),
      data: el.append('g').attr("class", "chart__data"),
      frame: el.append("rect")
        .attr("class", "chart__box"),
      hoverLine: el.append('line').attr('class', 'chart__marker-line'),
      hoverArea: el.append('rect'),
      tooltip: d3.select('#tooltip').attr('class', 'chart__tooltip')
    }
  }

  function renderBarTooltip(title, items, context, render) {
    render = render || function (d) { 
      return '<div class="tooltip__item tooltip__item--multi">' + 
              '<span>' + d.name + ':</span> ' + d.value +
            '</div>'
    }
    var xFlipped = (d3.event.pageX > (window.innerWidth - 320))
    var yFlipped = (d3.event.clientY > (window.innerHeight - 140))
    var space = 32;
    context.els.tooltip
      .attr('class', 'chart__tooltip')
      .attr('style', 'transform: translate(' + 
        (xFlipped ? '-100%' : '0') + ', ' +
        (yFlipped ? '-100%' : '0') + 
      ')')
      .html('<h1>' + title + '</h1>')
      .style('display', 'block')
      .style('left', d3.event.pageX + ((xFlipped ? -1 : 1) * space) + 'px')
      .style('top', d3.event.pageY + ((yFlipped ? -1 : 1) * space) + 'px')
      .selectAll()
      .data(items).enter()
      .append('div')
      .attr('class', function (d) { return 'chart__tooltip-row chart__tooltip-row--' + d.idx })
      .html(render);
  }

/**
   * Renders the tooltip and hoverline
   * @param {*} items 
   * @param {*} els 
   * @param {*} event 
   */
  function renderHoverLine(position, context) {
    context.els.hoverLine
      .attr('class', 'chart__marker-line chart__marker-line--hover')
      .attr('style', `transform: translateX(${position}px)`)
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', context.height);
  }

  function renderBars(data, config, context) {

    // get data grouped by x value
    var groupedData = groupItems(data.items, function(d) { return d.x.getMonth() })
    var groupNames = data.items.map(function(d) { return d.id })

    var x1 = d3.scaleBand().domain(groupNames).rangeRound([0, context.x.bandwidth()]);

    var group = context.els.data.selectAll(".chart__bar-group")
      .data(groupedData)

    // enter each group
    var groupEls = group.enter().append("g")
      .attr("class", "chart__bar-group")
      .on('mousemove', function(d) {
        var title = chartConfig.format.xTooltip(d.data[0].value.x)
        var items = d.data.map(getHoverItem);
        renderBarTooltip(title, items, context, chartConfig.format.tooltip)
      })
      .on('mouseout', function () {
        if (context.els.tooltip) 
          context.els.tooltip.style('display', 'none');
      })
      .merge(group)
      .attr("transform",function(d) { return "translate(" + context.x(new Date(2020, d.id, 1)) + ",0)"; })
      
    var groupBars = groupEls.selectAll("rect")
      .data(function(d) { return d.data; })
      
    groupBars
      .enter()
      .append("rect") // add bars for new groups
      .attr('class', function (d, i) { return 'chart__bar chart__bar--' + d.idx })
      .attr("width", x1.bandwidth())
      .attr("x", function(d) { return x1(d.id); })
      .attr("y", function(d) { return context.y(0); })
      .attr("height", function(d) { return context.height - context.y(0); })
      .merge(groupBars) // merge existing bars for update
      .transition()
      .delay(function (d, i) {return i*100;})
      .duration(1000)
      .attr("width", x1.bandwidth())
      .attr("x", function(d) { return x1(d.id); })
      .attr("y", function(d) {
        return context.y(d.value.y); 
      })
      .attr("height", function(d) { return context.height - context.y(d.value.y); });
      
    // remove bars groups
    groupBars
      .exit()
      .transition()
      .duration(1000)
      .attr("width", 0)
      .attr("x", function(d) { return x1.bandwidth(); })
      .attr("y", function(d) { return context.y(0); })
      .attr("height", function(d) { return context.height - context.y(0); })
      .remove()    

    var groupDots = groupEls.selectAll("circle")
      .data(function(d) { return config.dots ? d.data : []; })
    
    groupDots
      .enter()
      .append("circle") // add bars for new groups
      .attr('class', function (d, i) { return 'chart__dot chart__dot--' + i })
      .attr("r", 0)
      .attr("cx", function(d) { return x1(d.id) + x1.bandwidth()/2; })
      .attr("cy", function(d) { return context.y(0); })
      .merge(groupBars) // merge existing bars for update
      .transition()
      .delay(function (d, i) {return i*100;})
      .duration(1000)
      .attr("r", 4)
      .attr("cx", function(d) { return x1(d.id) + x1.bandwidth()/2; })
      .attr("cy", function(d) {
        console.log(d.value.extras[config.dots])
        return context.y(d.value.extras[config.dots]); 
      })
      
    // remove dots
    groupDots
      .exit()
      .transition()
      .duration(1000)
      .attr("r", 0)
      .attr("cx", function(d) { return x1(d.id) + x1.bandwidth()/2; })
      .attr("cy", function(d) { return context.y(0); })
      .remove()    
  


    group.exit().remove()
  }

  /**
   * Renders lines for the data
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderLines(data, config, context) {
    // setup line generation function
    const line = d3.line()
      .x(function (d) { return context.x(d.x) })
      .y(function (d) { return context.y(d.y) });

    // lines
    var lines = context.els.data.selectAll(".chart__line")
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
  }

  /**
   * Renders the x and y axis
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderAxis(data, config, context) {
    // setup x axis
    var xAxis = d3.axisBottom(context.x)
      .ticks(config.view.xTicks)
      .tickFormat(config.format.x);

    // setup y axis
    var yAxis = d3.axisLeft(context.y)
      .ticks(config.view.yTicks)
      .tickSize(-context.width)
      .tickFormat(config.format.y);

    // y axis
    context.els.yAxis
      .transition()
      .duration(1000)
      .call(yAxis);

    // x axis
    context.els.xAxis
      .attr('transform', 'translate(0,' + context.height + ')')
      .transition()
      .duration(1000)
      .call(xAxis);
  }

  /**
   * Renders the mark lines
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderAreaLines(data, config, context) {
    // setup mark line data
    var markLineData = []
    if (
      data.area[0] > context.xExtent[0] && 
      data.area[0] < context.xExtent[1]
    )
      markLineData.push({ 
        point: data.area[0], 
        lines: ['start of', 'moratorium'] 
      })
    if (
      data.area[1] > context.xExtent[0] && 
      data.area[1] < context.xExtent[1]
    )
      markLineData.push({ 
        point: data.areaEnd, 
        lines: ['end of', 'moratorium'] 
      })

    // moratorium lines
    var markLine = context.els.markLines
      .selectAll(".chart__mark-line")
      .data(markLineData)
    markLine
      .enter()
      .append('line')
      .attr('class', 'chart__mark-line')
      .merge(markLine)
      .attr('x1', d => context.x(d.point))
      .attr('x2', d => context.x(d.point))
      .attr('y1', 0)
      .attr('y2', context.height + 32)

    // moratorium labels
    var markLabel = context.els.markLines
      .selectAll(".chart__mark-label")
      .data(markLineData) 
    markLabel
      .enter()
      .append('text')
      .attr('class', 'chart__mark-label')
      .merge(markLabel)
      .html(function(d) { 
        return d.lines.map(function (l,i) {
          return '<tspan text-anchor="middle" dx="0" dy="'+ i * 16 +'">' + l + '</tspan>' 
        }).join('') 
      })
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('x', function(d) { return context.x(d.point) })
      .attr('y', context.height + 44);
  }

  function renderMarkLine(data, config, context) {
    // y axis mark lines
    var markLine = context.els.markLines
      .selectAll(".chart__mark-line--y")
      .data(config.markLines)

    markLine
      .enter()
      .append('line')
      .attr('class', 'chart__mark-line--y')
      .attr('x1', d => 0)
      .attr('x2', d => context.width)
      .attr('y1', context.height)
      .attr('y2', context.height)
      .merge(markLine)
      .transition()
      .duration(1000)
      .attr('x1', d => 0)
      .attr('x2', d => context.width)
      .attr('y1', d => context.y(d.y))
      .attr('y2', d => context.y(d.y))
      
    markLine.exit()
      .transition()
      .duration(1000)
      .attr('y1', context.height)
      .attr('y2', context.height)
      .remove()

    var markLabel = context.els.markLines
      .selectAll(".chart__mark-label--y")
      .data(config.markLines)

    markLabel
      .enter()
      .append('text')
      .attr('class', 'chart__mark-label--y')
      .html(function(d) { return d.label })
      .attr('x', d => context.width - 4)
      .attr('y', d => context.height - 4)
      .attr('fill-opacity', 0)
      .merge(markLabel)
      .transition()
      .duration(1000)
      .attr('text-anchor', 'end')
      .attr('x', d => context.width - 4)
      .attr('y', d => context.y(d.y) - 4)
      .attr('fill-opacity', 1)

    markLabel
      .exit()
      .transition()
      .duration(1000)
      .attr('x', d => context.width - 4)
      .attr('y', d => context.height - 4)
      .attr('fill-opacity', 0)
      .remove()
  }

  /**
   * Renders the mark area
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderMarkArea(data, config, context) {
    // moratorium area rect
    context.els.area
      .attr("x", context.x(data.markArea[0]))
      .attr("y", 0)
      .attr("width", context.x(data.markArea[1]) - context.x(data.markArea[0]))
      .attr("height", context.height)
  }

  /**
   * Renders the outline of the chart
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderFrame(data, config, context) {
    // bounding rect border
    context.els.frame
      .attr("x", -1)
      .attr("y", 0)
      .attr("width", context.width + 1)
      .attr("height", context.height + 1)
  }

  /**
   * Renders the hover area and add event handlers for tooltip
   * @param {*} data 
   * @param {*} config 
   * @param {*} context 
   */
  function renderHoverArea(data, config, context) {
    var bisectX = d3.bisector(function (d) { return d.x }).right

    var handleHover = function () {
      var xHovered = context.x.invert(d3.mouse(context.els.hoverArea.node())[0]);
      var set1 = data.items[0].data
      var dataIndex = bisectX(set1, xHovered);
      var xNext = set1[dataIndex].x
      var xPrev = set1[dataIndex - 1].x
      var xSnapped =
        Math.abs(xHovered.getTime() - xPrev.getTime()) >
          Math.abs(xHovered.getTime() - xNext.getTime())
          ? xNext : xPrev
      var xIndex = xSnapped === xNext ? dataIndex : dataIndex - 1
      var title =  config.format.xTooltip(xSnapped)
      // transform items into structure for tooltip
      var items = data.items
        .map(function (d, i) {
          return {
            idx: d.idx,
            name: d.name,
            value: config.format.yTooltip(d.data[xIndex].y),
            _raw: d.data[xIndex].y
          }
        })
        .sort(function (a, b) {
          return b.value - a.value;
        })
      var position = context.x(xSnapped)
      renderHoverLine(position, conext)
      renderBarTooltip(title, items, context, config.format.tooltip)
    }

    var handleHoverOut = function () {
      if (context.els.tooltip) 
        context.els.tooltip.style('display', 'none');
      if (context.els.hoverLine) 
        context.els.hoverLine.attr('class', 'chart__marker-line');
    }

    context.els.hoverArea
      .attr('width', context.width)
      .attr('height', context.height)
      .attr('opacity', 0)
      .on('mousemove', handleHover)
      .on('mouseout', handleHoverOut)
  }

  function renderContentUpdates(content) {
    content.forEach(function(item) {
      var el = document.querySelector(item.selector)
      if (!el) throw new Error('no element found for selector: ' + item.selector)
      el.innerHTML = item.text
      console.log(el, item.text, item.selector)
    })
  }

  function renderLegend(selector, items) {
    var LegendItem = function(item) {
      return '<div class="legend-item legend-item--'+ item.idx +'">' +
        '<div class="legend-item__color"></div>' +
        '<div class="legend-item__label">' + item.name + '</div>' +
      '</div>'
    }
    var el = document.querySelector(selector)
    if (!el) throw new Error('no element found for selector: ' + item.selector)
    el.innerHTML = items.map(function(item) { return LegendItem(item) }).join('')
  }

  /**
   * Render the full graph
   * @param {*} data 
   * @param {*} els 
   */
  function renderGraph(data, els, config) {
    // get parent width and height
    var rect = els.root.node().parentNode.getBoundingClientRect()

    // position the root
    els.root.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

    // account for margins
    var width = rect.width - margin.left - margin.right;
    var height = rect.height - margin.top - margin.bottom;

    // extents
    var xExtent = data.extents[0]
    var yExtent = data.extents[1]

    var xBands = d3.timeMonth.range(
      d3.timeMonth.floor(xExtent[0]), 
      d3.timeMonth.floor(d3.timeMonth.offset(xExtent[1], 1)), 
      1
    )

    var xTimeScale = d3.scaleTime().rangeRound([0, width]).domain(xExtent)
    var xBandScale = d3.scaleBand().rangeRound([0, width]).padding(0.5).domain(xBands)

    // setup scales
    var x = config.view.type === "line" 
      ? xTimeScale
      : xBandScale;
    var y = config.view.type === "line" 
      ? d3.scaleLinear().rangeRound([height, 0]).domain(yExtent) :
        d3.scaleLinear().rangeRound([height, 0]).domain([0, yExtent[1]])


    // context passed to render functions
    var context = {
      els: els,
      width: width,
      height: height,
      x: x,
      y: y,
      xExtent: xExtent,
      yExtent: yExtent
    }

    renderAxis(data, config, context)
    config.data.markArea && renderMarkArea(data, config, context)
    config.data.markArea && renderAreaLines(data, config, context)
    config.view.type === "line" && renderLines(data, config, context)
    config.view.type === "bar" && renderBars(data, config, context)
    config.markLines && renderMarkLine(data, config, context)
    config.view.type === "line" && renderHoverArea(data, config, context)
    renderFrame(data, config, context)
    config.content && renderContentUpdates(config.content)
    config.legend && renderLegend(config.legend, data.items)
  }

  function render() {
    renderGraph(parsedData, elements, chartConfig)
  }

  function update(newConfig) {
    if (!elements)
      elements = initElements(root)
    if (newConfig)
      chartConfig = newConfig
    parsedData = parseData(source, chartConfig)
    render()
  }

  update(config)

  return {
    root: root,
    render: render,
    update: update
  }
}

/**
 * 
 * @param {*} elementId id of the svg element (must be svg)
 * @param {*} config the chart config
 */
function createChart(elementId, config, callback) {

  // Load the data and draw a chart
  d3.csv(config.url, function (data) {
    if (data) {
      var root = d3.select(elementId).append('g')

      // create chart
      const chart = LineChart(data, root, config)

      // resize the chart when the window size changes
      window.addEventListener('resize', function () {
        chart.render()
      });

      // send chart to callback
      if (callback) callback(chart)
    } else {
      if (callback)
        callback(null, 'error loading data')
    }
  })

}