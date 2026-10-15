// heatmap.js

// chart settings and constants
const margin = { top: 50, right: 120, bottom: 50, left: 100 };
const width = 1100 - margin.left - margin.right;
const height = 800 - margin.top - margin.bottom;

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// discrete color palette from blue to red
const heatColors = ["#5e4fa2", "#3288bd", "#66c2a5", "#abdda4", "#e6f598", "#ffffbf", "#fee08b", "#fdae61", "#f46d43", "#d53e4f", "#9e0142"];

// setup svg container
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

// data loading
d3.csv("temperature_daily.csv").then(rawData => {
    const parsedData = processData(rawData);
    drawMatrix(parsedData);
}).catch(err => console.error("Failed to load data:", err));

// clean and group the data
function processData(data) {
    data.forEach(d => {
        const parts = d.date.split("-");
        d.year = +parts[0];
        d.monthNum = parts[1];
        d.monthName = months[+parts[1] - 1];
        d.day = +parts[2];
        d.max_temp = +d.max_temperature;
        d.min_temp = +d.min_temperature;
    });

    // get the 10 most recent years
    const allYears = Array.from(new Set(data.map(d => d.year))).sort((a, b) => b - a);
    const recentYears = allYears.slice(0, 10).sort((a, b) => a - b);
    const filtered = data.filter(d => recentYears.includes(d.year));

    // group by year and month
    const grouped = d3.rollups(filtered, 
        v => ({
            maxTemp: d3.max(v, d => d.max_temp),
            minTemp: d3.min(v, d => d.min_temp),
            year: v[0].year,
            monthName: v[0].monthName,
            monthNum: v[0].monthNum,
            dailyData: v.sort((a, b) => a.day - b.day)
        }), 
        d => d.year, 
        d => d.monthName
    );

    // flatten map for d3 binding
    const flatData = [];
    for (let [year, monthMap] of grouped) {
        for (let [monthName, values] of monthMap) {
            flatData.push(values);
        }
    }
    
    return { raw: flatData, years: recentYears };
}

// main render function
function drawMatrix({ raw, years }) {
    // scales
    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.1);

    const yScale = d3.scaleBand()
        .domain(months)
        .range([0, height])
        .padding(0.1);

    const colorScale = d3.scaleQuantize()
        .domain([0, 40])
        .range(heatColors);

    // axes
    svg.append("g")
        .attr("transform", "translate(0,-5)")
        .call(d3.axisTop(xScale).tickSizeOuter(0));

    svg.append("g")
        .call(d3.axisLeft(yScale).tickSizeOuter(0));

    // inner sparkline scales
    const sparkX = d3.scaleLinear()
        .domain([1, 31])
        .range([2, xScale.bandwidth() - 2]);

    const sparkY = d3.scaleLinear()
        .domain([0, 40])
        .range([yScale.bandwidth() - 2, 2]);

    const lineMax = d3.line()
        .x(d => sparkX(d.day))
        .y(d => sparkY(d.max_temp));

    const lineMin = d3.line()
        .x(d => sparkX(d.day))
        .y(d => sparkY(d.min_temp));

    // bind data to cell groups
    const cells = svg.selectAll(".cell")
        .data(raw)
        .enter()
        .append("g")
        .attr("class", "cell")
        .attr("transform", d => `translate(${xScale(d.year)}, ${yScale(d.monthName)})`);

    // hover events
    cells.on("mouseover", function() {
        tooltip.style("opacity", 1);
        d3.select(this).select("rect").style("stroke", "#000").style("stroke-width", 2);
    })
    .on("mousemove", function(event, d) {
        tooltip.html(`Date: ${d.year}-${d.monthNum}, max: ${Math.round(d.maxTemp)} min: ${Math.round(d.minTemp)}`)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseleave", function() {
        tooltip.style("opacity", 0);
        d3.select(this).select("rect").style("stroke", "white").style("stroke-width", 0);
    });

    // 1. draw background rect
    cells.append("rect")
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .style("fill", d => colorScale(d.maxTemp));

    // 2. draw min temp sparkline (light blue)
    cells.append("path")
        .attr("d", d => lineMin(d.dailyData))
        .attr("fill", "none")
        .attr("stroke", "#87ceeb")
        .attr("stroke-width", 1.5);

    // 3. draw max temp sparkline (green)
    cells.append("path")
        .attr("d", d => lineMax(d.dailyData))
        .attr("fill", "none")
        .attr("stroke", "#4daf4a")
        .attr("stroke-width", 1.5);

    drawLegend();
}

// draw color legend
function drawLegend() {
    const legendWidth = 20;
    const legendHeight = 250;
    const blockHeight = legendHeight / heatColors.length;

    const legend = svg.append("g")
        .attr("transform", `translate(${width + 20}, 0)`);

    legend.selectAll("rect")
        .data(heatColors)
        .enter()
        .append("rect")
        .attr("y", (d, i) => i * blockHeight)
        .attr("width", legendWidth)
        .attr("height", blockHeight)
        .style("fill", d => d);

    legend.append("text")
        .attr("x", legendWidth + 8)
        .attr("y", 10)
        .style("font-size", "12px")
        .text("0 Celsius");

    legend.append("text")
        .attr("x", legendWidth + 8)
        .attr("y", legendHeight)
        .style("font-size", "12px")
        .text("40 Celsius");
}