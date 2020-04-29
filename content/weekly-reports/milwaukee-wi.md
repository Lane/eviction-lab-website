---
  chart1data: /data/milwaukee/chart1.csv
  chart2data: /data/milwaukee/chart2.csv
  tabledata: /data/table.csv
  mapdata: /data/milwaukee/map.csv
  geojson: /data/milwaukee/shapes.json
  fips: "55079"
  h1: "Milwaukee, Wisconsin"
  title: "Milwaukee, Wisconsin | Weekly Eviction Reports | Eviction Lab"
---

{{% report_intro fips="55079" data="/data/table.csv" %}}

Milwaukee intro

{{%/ report_intro %}}

{{% report_chart id="avg" data="/data/milwaukee/chart1.csv" %}}

# Changes in eviction filings

Milwaukee chart 1

  1. Average eviction filings taken from Eviction Lab data for 2012–2015  
  2. Filing data for 2020 collected by [January Advisors](https://www.januaryadvisors.com/)
  3. Partial filings for April, as of April 25

{{%/ report_chart %}}

{{% report_map 
      shapes="/data/milwaukee/shapes.json" 
      data="/data/milwaukee/map.csv"  %}}

# The geography of changes in eviction filings

Milwaukee map

  1. Average eviction filings taken from Eviction Lab data for 2012–2015
  2. Tract racial majority determined using American Community Survey (ACS) estimates for 2014–2018

{{%/ report_map %}}

{{% report_chart id="race" data="/data/milwaukee/chart2.csv" %}}

# Eviction filings by neighborhood demographics

Milwaukee chart 2

  1. Average eviction filings taken from Eviction Lab data for 2012–2015
  2. Partial filings for April, as of April 25

{{%/ report_chart %}}