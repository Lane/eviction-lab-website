---
  childof: eviction-watch
  chart1data: /reports/harris-county/chart1_w16.csv
  chart2data: /reports/harris-county/chart2_w16.csv
  tabledata: /reports/table.csv
  mapdata: /reports/harris-county/map.csv
  geojson: /reports/harris-county/tracts.json
  fips: "48201"
  h1: "Houston, Texas"
  datadate: "April 22, 2020"
  title: "Houson, Texas | Weekly Eviction Reports | Eviction Lab"
  scripts: weekly
---

{{< report_intro moratorium="March 19 - April 30, 2020" >}}

Eviction filings in the last week continue to be lower than the average from 2012 to 2016. An eviction moratorium is currently in place which has had a chilling effect on filings since it was invoked on March 19, 2020.

{{</ report_intro >}}

{{< report_chart id="avg" title="How do eviction filings compare to average this time of year?" >}}

The number of eviction filings in Harris County were higher than average at the beginning of the year. The number of filings have dropped to below average numbers during the eviction moratorium put in place on March 19.

{{</ report_chart >}}

{{< report_map title="Which neighborhoods are most impacted?" >}}

The map highlights eviction filings by census tract since March 22, 2020.  The eviction moratorium has been in place since March 19, yet some areas are still experiencing more eviction filings than previous years.

{{</ report_map >}}

{{< report_chart id="race" title="Who is most impacted?" >}}

Since the moratorium invoke on March 19, eviction filings for all demographics have dropped to below average numbers. 

{{</ report_chart >}}