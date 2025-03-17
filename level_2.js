// Configuration
const margin = { top: 50, right: 100, bottom: 50, left: 80 };
const width = 1100 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;
const padding = 2; // Padding inside each cell for the mini chart

// Initialize visualization state
let currentTempType = "both"; // "both", "max_temperature", or "min_temperature"

// Create SVG container
const svg = d3.select("#level-2")
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
        d.day = d.date.getDate();
    });

    // Filter out data prior to year 2008
    data = data.filter(d => d.year >= 2008);

    // Group data by year and month
    const nestedData = d3.groups(data, d => d.year, d => d.month);
    
    // Get unique years and calculate cell dimensions
    const years = [...new Set(data.map(d => d.year))].sort();
    const months = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];
    
    
    // Create color scales for cell backgrounds
    const maxTempColorScale = d3.scaleSequential()
        .domain([d3.min(data, d => d.max_temperature), d3.max(data, d => d.max_temperature)])
        .interpolator(d3.interpolateReds);

    const minTempColorScale = d3.scaleSequential()
        .domain([d3.min(data, d => d.min_temperature), d3.max(data, d => d.min_temperature)])
        .interpolator(d3.interpolateBlues);

    // Create x and y scales for the matrix
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
    svg.append("text")
        .attr("class", "chart-title")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", -20)
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Daily Temperature Variations by Month and Year");

    // Create cell groups
    const cells = svg.selectAll(".cell-group")
        .data(nestedData)
        .join("g")
        .attr("class", "year-group")
        .selectAll(".month-cell")
        .data(([year, monthData]) => {
            return monthData.map(([month, dayData]) => {
                // Sort day data by day of month
                dayData.sort((a, b) => a.day - b.day);
                
                // Calculate monthly averages for background color
                const avgMaxTemp = d3.mean(dayData, d => d.max_temperature);
                const avgMinTemp = d3.mean(dayData, d => d.min_temperature);
                
                return {
                    year,
                    month,
                    dayData,
                    avgMaxTemp,
                    avgMinTemp
                };
            });
        })
        .join("g")
        .attr("class", "month-cell")
        .attr("transform", d => `translate(${xScale(d.year)}, ${yScale(d.month)})`);

    // Add background rectangles for each cell
    cells.append("rect")
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => getBackgroundColor(d))
        .attr("class", "cell-bg");

    // Function to create mini line charts
    function createMiniCharts(cells, padding, currentTempType) {
        // Remove existing charts first
        cells.selectAll(".mini-chart").remove();
        
        // Create mini chart groups
        const miniCharts = cells.append("g")
            .attr("class", "mini-chart")
            .attr("transform", `translate(${padding}, ${padding})`);
        
        // Create scales for mini charts
        miniCharts.each(function(d) {
            const miniWidth = xScale.bandwidth() - 2 * padding;
            const miniHeight = yScale.bandwidth() - 2 * padding;
            
            const miniXScale = d3.scaleLinear()
                .domain([1, 31]) // Assuming max 31 days in a month
                .range([0, miniWidth]);
            
            // Find min and max across both temperature types for consistent y-scale
            const allTemps = [];
            d.dayData.forEach(day => {
                allTemps.push(day.max_temperature);
                allTemps.push(day.min_temperature);
            });
            
            const miniYScale = d3.scaleLinear()
                .domain([d3.min(allTemps), d3.max(allTemps)])
                .range([miniHeight, 0]);
            
            // Create line generators
            const maxLine = d3.line()
                .x(d => miniXScale(d.day))
                .y(d => miniYScale(d.max_temperature));
            
            const minLine = d3.line()
                .x(d => miniXScale(d.day))
                .y(d => miniYScale(d.min_temperature));
            
            const chartGroup = d3.select(this);
            
            // Draw max temperature line if needed
            if (currentTempType === "both" || currentTempType === "max_temperature") {
                chartGroup.append("path")
                    .datum(d.dayData)
                    .attr("class", "max-temp-line")
                    .attr("d", maxLine);
            }
            
            // Draw min temperature line if needed
            if (currentTempType === "both" || currentTempType === "min_temperature") {
                chartGroup.append("path")
                    .datum(d.dayData)
                    .attr("class", "min-temp-line")
                    .attr("d", minLine);
            }
            
            // Add invisible overlay for tooltips
            chartGroup.append("rect")
                .attr("height", miniHeight)
                .attr("width", miniWidth)
                .attr("fill", "transparent")
                .on("mouseout", function() {
                    tooltip.transition()
                        .duration(400)
                        .style("opacity", 0);
                })
                .on("mousemove", function(event) {
                    // Calculate which day is being hovered
                    const [mouseX] = d3.pointer(event, this);
                    const dayIndex = Math.floor(mouseX / (miniWidth / 31));
                    const day = Math.min(Math.max(1, dayIndex + 1), 31);
                    
                    // Find the data for that day
                    const dayData = d.dayData.find(data => data.day === day);
                    
                    if (dayData) {
                        tooltip.transition()
                            .duration(100)
                            .style("opacity", 1);
                        
                        tooltip.html(`
                            <strong>Date:</strong> ${months[d.month]} ${day}, ${d.year}<br>
                            <strong>Max Temp:</strong> ${dayData.max_temperature.toFixed()}°C<br>
                            <strong>Min Temp:</strong> ${dayData.min_temperature.toFixed()}°C
                        `)
                            .style("top", (event.pageY - 20) + "px")
                            .style("left", (event.pageX + 12) + "px");
                    }
                });
        });
    }

    // Function to get background color based on display mode
    function getBackgroundColor(d) {
        if (currentTempType === "max_temperature" || currentTempType === "both") {
            return maxTempColorScale(d.avgMaxTemp);
        } else if (currentTempType === "min_temperature") {
            return minTempColorScale(d.avgMinTemp);
        }
    }

    // Function to create the legend
    function createLegend(svg, width, currentTempType, maxTempColorScale, minTempColorScale) {
        // Remove existing legend
        svg.selectAll(".legend").remove();
        
        const legendWidth = 20;
        const legendHeight = 300;
        
        const legendGroup = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 40}, ${20})`);
        
        // Title changes based on display mode
        let title = "Temperature";
        let colorScale;
        
        if (currentTempType === "max_temperature" || currentTempType === "both") {
            colorScale = maxTempColorScale;
        } else if (currentTempType === "min_temperature") {
            colorScale = minTempColorScale;
        }
        
        legendGroup.append("text")
            .attr("class", "legend-title")
            .attr("x", -20)
            .attr("y", -10)
            .text(title);
        
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
                .attr("width", legendWidth)
                .attr("height", rectHeight)
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
        
        // Add line legend if in "both" mode
        if (currentTempType === "both") {
            const lineLegendGroup = svg.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width + 40}, ${legendHeight + 40})`);
            
            // Max temperature line
            lineLegendGroup.append("line")
                .attr("x1", 0)
                .attr("y1", 0)
                .attr("x2", 30)
                .attr("y2", 0)
                .attr("class", "max-temp-line");
            
            lineLegendGroup.append("text")
                .attr("x", 35)
                .attr("y", 4)
                .text("Max")
                .style("font-size", "12px");
            
            // Min temperature line
            lineLegendGroup.append("line")
                .attr("x1", 0)
                .attr("y1", 20)
                .attr("x2", 30)
                .attr("y2", 20)
                .attr("class", "min-temp-line");
            
            lineLegendGroup.append("text")
                .attr("x", 35)
                .attr("y", 24)
                .text("Min")
                .style("font-size", "12px");
        }
    }

    // Function to update the visualization
    function updateVisualization() {
        // Update background colors
        cells.selectAll(".cell-bg")
            .attr("fill", d => getBackgroundColor(d));
        
        // Update mini charts
        createMiniCharts(cells, padding, currentTempType);
        
        // Update legend
        createLegend(svg, width, currentTempType, maxTempColorScale, minTempColorScale);
    }

    // Initialize visualization
    updateVisualization();

    // Add event listeners for buttons
    d3.select("#showBothBtn").on("click", function() {
        if (currentTempType !== "both") {
            currentTempType = "both";
            d3.select(this).classed("active", true);
            d3.select("#maxTempBtn").classed("active", false);
            d3.select("#minTempBtn").classed("active", false);
            updateVisualization();
        }
    });

    d3.select("#maxTempBtn").on("click", function() {
        if (currentTempType !== "max_temperature") {
            currentTempType = "max_temperature";
            d3.select(this).classed("active", true);
            d3.select("#showBothBtn").classed("active", false);
            d3.select("#minTempBtn").classed("active", false);
            updateVisualization();
        }
    });

    d3.select("#minTempBtn").on("click", function() {
        if (currentTempType !== "min_temperature") {
            currentTempType = "min_temperature";
            d3.select(this).classed("active", true);
            d3.select("#showBothBtn").classed("active", false);
            d3.select("#maxTempBtn").classed("active", false);
            updateVisualization();
        }
    });
});
