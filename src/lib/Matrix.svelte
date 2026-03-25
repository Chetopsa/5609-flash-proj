<script lang="ts">
  import type { TMovie } from "../types";
  import * as d3 from "d3";
  import _ from "lodash";

  type Props = {
    movies: TMovie[];
    width?: number;
    height?: number;
  };

  let { movies, width = 600, height = 600 }: Props = $props();

  let hoveredCell: { genre1: string; genre2: string; count: number } | null = $state(null);

  
  function getCoOccurrenceMatrix(movies: TMovie[]) {

    const allGenres = _.uniq(movies.flatMap(m => m.genres)).sort();

    let coOccurrences: { [key: string]: number } = {};

    movies.forEach(movie => {
      const genres = movie.genres;
      for (let i = 0; i < genres.length; i++) {
        for (let j = 0; j < genres.length; j++) {
          const key = `${genres[i]}|${genres[j]}`;
          coOccurrences[key] = (coOccurrences[key] || 0) + 1;
        }
      }
    });

    const matrixData: { genre1: string; genre2: string; count: number }[] = [];
    for (const genre1 of allGenres) {
      for (const genre2 of allGenres) {
        const key = `${genre1}|${genre2}`;
        matrixData.push({
          genre1,
          genre2,
          count: coOccurrences[key] || 0
        });
      }
    }


    const maxCount = d3.max(matrixData.filter(m => m.genre1 !== m.genre2), co => co.count) || 1;

    return { matrixData, genres: allGenres, maxCount };
  }

  const matrix = $derived(getCoOccurrenceMatrix(movies));
  const margin = {
    top: 100,
    bottom: 20,
    left: 100,
    right: 20,
  };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
  };

  const cellSize = $derived(
    Math.min(
      (usableArea.right - usableArea.left) / matrix.genres.length,
      (usableArea.bottom - usableArea.top) / matrix.genres.length
    )
  );

  const xScale = $derived(
    d3.scaleBand()
      .domain(matrix.genres)
      .range([usableArea.left, usableArea.left + cellSize * matrix.genres.length])
      .padding(0.05)
  );

  const yScale = $derived(
    d3.scaleBand()
      .domain(matrix.genres)
      .range([usableArea.top, usableArea.top + cellSize * matrix.genres.length])
      .padding(0.05)
  );

  const colorScale = $derived(
    d3.scaleSequential()
      .domain([0, matrix.maxCount])
      .interpolator(d3.interpolateOrRd)
  );

  
  let xAxis: any = $state(),
    yAxis: any = $state();

  function updateAxis() {
    if (xAxis) {
      d3.select(xAxis)
        .call(d3.axisTop(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "start")
        .attr("dx", "3px")
        .attr("dy", "3px");
      
      d3.select(xAxis).select(".domain").remove();
      d3.select(xAxis).selectAll(".tick line").remove();
    }
    if (yAxis) {
      d3.select(yAxis)
        .call(d3.axisLeft(yScale))
      
      d3.select(yAxis).select(".domain").remove();
      d3.select(yAxis).selectAll(".tick line").remove();
    }
  }

  $effect(() => {
    if (matrix.genres.length > 0 && xAxis && yAxis) {
      updateAxis();
    }
  });
</script>

<h3>Genre Co-Occurrence Matrix</h3>
<div class="container">
{#if matrix.matrixData.length > 0}
  <div>
  <svg {width} {height}>
    <g bind:this={xAxis} transform="translate(0, {usableArea.top})" />
    <g bind:this={yAxis} transform="translate({usableArea.left}, 0)" />
    <g class="cells">
      {#each matrix.matrixData as cell}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          x={xScale(cell.genre1)}
          y={yScale(cell.genre2)}
          width={xScale.bandwidth()}
          height={yScale.bandwidth()}
          fill={colorScale(cell.count)}
        
          onmouseenter={() => hoveredCell = cell}
          onmouseleave={() => hoveredCell = null}
        >
          <title>{cell.genre1} & {cell.genre2}: {cell.count} co-occurrences</title>
        </rect>
      {/each}
    </g>
   

    
  </svg>
  </div>

  <!-- hovere cell info -->
   
    {#if hoveredCell}
    <div>
        <p class="hover-info">
        <strong>{hoveredCell.genre1}</strong> & <strong>{hoveredCell.genre2}</strong>: 
        {hoveredCell.count} co-occurrence{hoveredCell.count !== 1 ? 's' : ''}
        </p>
    </div>
    {:else}

     <div>
        <p class="hover-info">
        <strong>No hover cells hovered</strong>
    </div>
    {/if}
    {/if}
</div>
<style>
    .container {
    display: flex;
    flex-direction: row;
    align-items: center;
    }

  .cells rect {
    cursor: pointer;
  }

  .hover-info {
    margin-top: 10px;
    font-size: 14px;
    padding: 10px 10px;
    background: lightgrey;
    border-radius: 4px;
    display: inline-block;
  }

  h3 {
    margin-bottom: 10px;
  }
</style>
