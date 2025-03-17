// Configuration
const margin = { top: 50, right: 100, bottom: 50, left: 80 };
const width = 1100 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const cellSize = 30;

// Initialize visualization state
let currentTempType = "max_temperature";

// Create SVG container
const svg = d3.select("#level-1")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

// Create tooltip
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Load and process data
d3.csv("temperature_daily.csv").then(data => {
    // Process the data
    data.forEach(d => {
        const [year, month, day] = d.date.split("-").map(Number);
        d.date = new Date(year, month - 1, day);
        d.max_temperature = +d.max_temperature;
        d.min_temperature = +d.min_temperature;
        d.year = d.date.getFullYear();
        d.month = d.date.getMonth();
    });

    // Group data by year and month, calculating average temperatures
    const groupedData = d3.rollups(
        data,
        v => ({
            max_temperature: d3.max(v, d => d.max_temperature),
            min_temperature: d3.min(v, d => d.min_temperature),
            date: v[0].date // Keep a reference date for the month/year
        }),
        d => d.year,
        d => d.month
    );

    // Convert to array format for easier processing
    const matrixData = [];
    groupedData.forEach(([year, monthData]) => {
        monthData.forEach(([month, values]) => {
            matrixData.push({
                year,
                month,
                max_temperature: values.max_temperature,
                min_temperature: values.min_temperature,
                date: values.date
            });
        });
    });

    // Get unique years for x-axis
    const years = [...new Set(matrixData.map(d => d.year))].sort();
    // Get unique months for y-axis
    const months = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];

    // Create color scales
    const maxTempColorScale = d3.scaleSequential()
        .domain([d3.min(matrixData, d => d.max_temperature), d3.max(matrixData, d => d.max_temperature)])
        .interpolator(d3.interpolateReds);

    const minTempColorScale = d3.scaleSequential()
        .domain([d3.min(matrixData, d => d.min_temperature), d3.max(matrixData, d => d.min_temperature)])
        .interpolator(d3.interpolateBlues);

    // Create x and y scales
    const xScale = d3.scaleBand()
        .domain(years)
        .range([0, width])
        .padding(0.05);

    const yScale = d3.scaleBand()
        .domain(d3.range(12))
        .range([0, height])
        .padding(0.05);

    // Draw x-axis
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d => d));

    // Draw y-axis
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat(d => months[d]));

    // Add axis labels
    svg.append("text")
        .attr("class", "x-label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .text("Year");

    svg.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -60)
        .text("Month");

    // Create title
    const chartTitle = svg.append("text")
        .attr("class", "chart-title")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", -20)
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Maximum Temperature by Month and Year");

    // Function to create the legend
    function createLegend(svg, width) {
        const legendGroup = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 40}, ${0})`);

        legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", -20)
            .attr("y", -10)
            .text("Temperature");

        return legendGroup;
    }

    // Function to update the legend
    function updateLegend(legendGroup, colorScale, legendHeight, legendWidth) {
        // Clear previous legend
        legendGroup.selectAll(".legend-rect, .legend-axis").remove();

        const domain = colorScale.domain();

        // Create gradient for legend
        const legendScale = d3.scaleLinear()
            .domain(domain)
            .range([legendHeight, 0]);

        // Create legend rectangles
        const numRects = 50;
        const rectHeight = legendHeight / numRects;

        for (let i = 0; i < numRects; i++) {
            const value = legendScale.invert(i * rectHeight);

            legendGroup.append("rect")
                .attr("class", "legend-rect")
                .attr("x", 0)
                .attr("y", i * rectHeight)
                .attr("height", rectHeight)
                .attr("width", legendWidth)
                .attr("fill", colorScale(value));
        }

        // Create legend axis
        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat(d => d.toFixed());

        legendGroup.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(${legendWidth}, 0)`)
            .call(legendAxis);
    }

    // Create legend
    const legendWidth = 20;
    const legendHeight = 300;
    const legendGroup = createLegend(svg, width);

    // Function to update the visualization
    function updateVisualization() {
        // Update chart title
        chartTitle.text(currentTempType === "max_temperature" 
            ? "Maximum Temperature by Month and Year" 
            : "Minimum Temperature by Month and Year");

        // Draw cells
        svg.selectAll(".cell")
            .data(matrixData)
            .join("rect")
            .attr("class", "cell")
            .attr("x", d => xScale(d.year))
            .attr("y", d => yScale(d.month))
            .attr("height", yScale.bandwidth())
            .attr("width", xScale.bandwidth())
            .attr("fill", d => {
                return currentTempType === "max_temperature" 
                    ? maxTempColorScale(d.max_temperature) 
                    : minTempColorScale(d.min_temperature);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1);
                
                tooltip.transition()
                    .duration(400)
                    .style("opacity", 0);
            })
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 2);
                
                tooltip.transition()
                    .duration(100)
                    .style("opacity", 1);
                
                const value = currentTempType === "max_temperature" 
                    ? d.max_temperature.toFixed() 
                    : d.min_temperature.toFixed();
                
                tooltip.html(`
                    <strong>Date:</strong> ${months[d.month]} ${d.year}<br>
                    <strong>${currentTempType === "max_temperature" ? "Max" : "Min"} Temperature:</strong> ${value}°C
                `)
                    .style("top", (event.pageY - 20) + "px")
                    .style("left", (event.pageX + 12) + "px");
            });

        // Update legend
        const colorScale = currentTempType === "max_temperature" 
            ? maxTempColorScale 
            : minTempColorScale;
        updateLegend(legendGroup, colorScale, legendHeight, legendWidth);
    }

    // Initialize visualization
    updateVisualization();

    // Add event listeners for buttons
    d3.select("#maxTempBtn").on("click", function() {
        if (currentTempType !== "max_temperature") {
            currentTempType = "max_temperature";
            d3.select(this).classed("active", true);
            d3.select("#minTempBtn").classed("active", false);
            updateVisualization();
        }
    });

    d3.select("#minTempBtn").on("click", function() {
        if (currentTempType !== "min_temperature") {
            currentTempType = "min_temperature";
            d3.select(this).classed("active", true);
            d3.select("#maxTempBtn").classed("active", false);
            updateVisualization();
        }
    });
});
