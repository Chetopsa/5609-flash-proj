<script lang="ts">
    import * as d3 from "d3";
    
    type LinePoint = {
      x:number;
      value:number;
    };
    
    type Series = {
      label:string;
      values:LinePoint[];
    };
    
    type Props = {
      series:Series[];
      width?:number;
      height?:number;
      title?:string;
      yLabel?:string;
      note?:string;
      legendTitle?:string;
      totalRuns?:number;
    };
    
    const props = $props<Props>();
    
    const series = $derived(props.series);
    const width = $derived(props.width ?? 950);
    const height = $derived(props.height ?? 450);
    const title = $derived(props.title ?? "Individual Runner Elevation Gain");
    const yLabel = $derived(props.yLabel ?? "Elevation Gain (m)");
    const note = $derived(props.note ?? "");
    const legendTitle = $derived(props.legendTitle ?? "Runner");
    const totalRuns = $derived(props.totalRuns ?? null);
    
    const margin = { top:35,right:240,bottom:70,left:85 };
    
    const usable = $derived({
     left:margin.left,
     right:width-margin.right,
     top:margin.top,
     bottom:height-margin.bottom
    });
    
    const allPoints = $derived(series.flatMap(s=>s.values));
    const allX = $derived(allPoints.map(d=>d.x));
    const allValues = $derived(allPoints.map(d=>d.value));
    const labels = $derived(series.map(s=>s.label));
    
    function getSeriesColor(){
     return "#E83E8C";
    }
    
    const xScale = $derived(
     d3.scaleLinear()
      .domain(
        allX.length
          ? [d3.min(allX)!, d3.max(allX)!]
          : [0,1]
       )
      .nice()
      .range([usable.left, usable.right])
    );
    
    const yScale = $derived(
     d3.scaleLinear()
      .domain(
       allValues.length
        ? [0,d3.max(allValues)!]
        : [0,1]
      )
      .nice()
      .range([usable.bottom,usable.top])
    );
    
    const lineGen = $derived(
     d3.line<LinePoint>()
       .x(d=>xScale(d.x))
       .y(d=>yScale(d.value))
       .curve(d3.curveMonotoneX)
    );
    
    let xAxis:SVGGElement = $state();
    let yAxis:SVGGElement = $state();
    let svgEl:SVGSVGElement = $state();
    
    $effect(()=>{
     if(xAxis && yAxis && series.length){
       d3.select(xAxis)
        .call(
          d3.axisBottom(xScale)
           .ticks(8)
           .tickFormat(d3.format("d"))
        );
    
       d3.select(yAxis)
        .call(d3.axisLeft(yScale));
     }
    });
    
    let hoverX = $state<number | null>(null);
    
    function handleSvgMouseMove(event:MouseEvent){
     if(!svgEl) return;
    
     const [mx,my]=d3.pointer(event,svgEl);
    
     if(
       mx<usable.left ||
       mx>usable.right ||
       my<usable.top ||
       my>usable.bottom
     ){
       hoverX=null;
       return;
     }
    
     hoverX=mx;
    }
    
    function clearHover(){
     hoverX=null;
    }
    
    const hoverRun = $derived(
     hoverX!==null
      ? Math.round(xScale.invert(hoverX))
      : null
    );
    
    function getClosestPoint(
     points:LinePoint[],
     run:number
    ):LinePoint|null{
    
     if(!points.length) return null;
    
     return points.reduce((best,current)=>{
       return Math.abs(current.x-run)
          < Math.abs(best.x-run)
           ? current
           : best;
     });
    }
    
    const hoverData = $derived(
     hoverRun===null
      ? []
      : series
          .map(s=>({
            label:s.label,
            point:getClosestPoint(
              s.values,
              hoverRun
            )
          }))
          .filter(
            (d):d is {
              label:string;
              point:LinePoint
            } => d.point!==null
          )
    );
    </script>
    
    <h3>{title}</h3>
    
    {#if series.length}
    <svg
     bind:this={svgEl}
     {width}
     {height}
     onmousemove={handleSvgMouseMove}
     onmouseleave={clearHover}
    >
    
    <g class="grid">
    {#each yScale.ticks(6) as tick}
    <line
     x1={usable.left}
     x2={usable.right}
     y1={yScale(tick)}
     y2={yScale(tick)}
    />
    {/each}
    </g>
    
    <g class="grid">
    {#each xScale.ticks(8) as tick}
    <line
     x1={xScale(tick)}
     x2={xScale(tick)}
     y1={usable.top}
     y2={usable.bottom}
    />
    {/each}
    </g>
    
    {#each series as s}
    <path
     class="runner-line"
     d={lineGen(s.values) ?? ""}
     fill="none"
     stroke={getSeriesColor()}
     stroke-width="2"
     opacity="0.9"
    />
    
    {#each s.values as v}
    <circle
     cx={xScale(v.x)}
     cy={yScale(v.value)}
     r="1.6"
     fill={getSeriesColor()}
     opacity="0.12"
    />
    {/each}
    
    {/each}
    
    {#if hoverRun !== null && hoverData.length > 0}
    
    <line
     class="hover-guide"
     x1={xScale(hoverRun)}
     x2={xScale(hoverRun)}
     y1={usable.top}
     y2={usable.bottom}
     stroke="#888"
     stroke-width="1"
     stroke-dasharray="4,4"
     opacity="0.55"
    />
    
    {#each hoverData as d}
    <circle
     class="hover-point"
     cx={xScale(d.point.x)}
     cy={yScale(d.point.value)}
     r="5"
     fill={getSeriesColor()}
     stroke="white"
     stroke-width="1.5"
    />
    {/each}
    
    {/if}
    
    <g
     transform={`translate(0,${usable.bottom})`}
     bind:this={xAxis}
    />
    
    <g
     transform={`translate(${usable.left},0)`}
     bind:this={yAxis}
    />
    
    <text
     x={(usable.left+usable.right)/2}
     y={height-15}
     text-anchor="middle"
     font-size="12"
    >
    Run Number
    </text>
    
    <text
     x={22}
     y={(usable.top+usable.bottom)/2}
     text-anchor="middle"
     font-size="12"
     transform={`rotate(-90,22,${(usable.top+usable.bottom)/2})`}
    >
    {yLabel}
    </text>
    
    {#if note}
    <text
     x={usable.left}
     y={usable.top-12}
     font-size="11"
     fill="#444"
    >
    {note}
    </text>
    {/if}
    
    <g transform={`translate(${usable.right+35},${usable.top+35})`}>
    <text
     font-size="12"
     font-weight="700"
    >
    {legendTitle}
    </text>
    
    {#each labels as label}
    <rect
     x="0"
     y="18"
     width="12"
     height="12"
     fill={getSeriesColor()}
    />
    
    <text
     x="18"
     y="28"
     font-size="12"
    >
    {label}
    </text>
    {/each}
    
    {#if totalRuns!==null}
    <text
     x="0"
     y="58"
     font-size="12"
     fill="#666"
    >
    Total runs: {totalRuns}
    </text>
    {/if}
    </g>
    
    {#if hoverRun !== null && hoverData.length > 0}
    
    {@const boxX = usable.right + 18}
    {@const boxY = usable.top + 120}
    
    <g class="tooltip" pointer-events="none">
    
    <rect
     x={boxX}
     y={boxY}
     width="200"
     height="66"
     rx="10"
    />
    
    <text
     x={boxX+16}
     y={boxY+26}
     font-size="13"
     font-weight="700"
    >
    Run #{hoverRun}
    </text>
    
    {#each hoverData as d}
    <text
     x={boxX+16}
     y={boxY+50}
     font-size="12"
    >
    Elevation gain:
    {d.point.value.toFixed(2)} m
    </text>
    {/each}
    
    </g>
    
    {/if}
    
    </svg>
    
    {:else}
    <p>No individual elevation data available.</p>
    {/if}
    
    <style>
    .grid line{
     stroke:#999;
     stroke-opacity:.12;
    }
    
    .tooltip rect{
     fill:white;
     stroke:#ccc;
    }
    
    .runner-line{
     vector-effect:non-scaling-stroke;
     transition:opacity .25s ease;
    }
    
    circle{
     transition:
      r .2s ease,
      opacity .2s ease,
      cx .25s ease,
      cy .25s ease;
    }
    
    .hover-point{
     animation:pulse 2s ease-in-out infinite alternate;
    }
    
    .hover-guide,
    .tooltip{
     animation:fadeIn .18s ease;
    }
    
    @keyframes pulse{
     from{
      r:4.5;
     }
     to{
      r:6.5;
     }
    }
    
    @keyframes fadeIn{
     from{
      opacity:0;
      transform:translateY(4px);
     }
    
     to{
      opacity:1;
      transform:translateY(0);
     }
    }
    </style>