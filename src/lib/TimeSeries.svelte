<script lang="ts">
    import type { TMovie } from "../types";
    import * as d3 from "d3";
    import _ from "lodash";

  // define the props of the Bar component
  type Props = {
    movies: TMovie[];
    progress?: number;
    width?: number;
    height?: number;
  };
  

  type genreYearCounts = {
    genre: string;
    year: number;
    count: number;
  }[];
  function yearToDate(year: number): Date {
    return new Date(Date.UTC(year, 0, 4));
  }
  let hoveredGenre: string | null = $state(null);

  function genreYearCountsList(movies: TMovie[]) {
    const counts = 
            _(movies)
            .flatMap(({genres, year}) => genres.map(genre => ({genre, year})))
            .groupBy(({genre, year}) => `${genre}|${year}`)
            .map((group, key) => {
                const [genre, year] = key.split("|");
                return {genre, year: Number(year), count: group.length}
            })
            .orderBy(['genre', 'year'])
            .value();

    console.log("Counts:", counts);
    const genres = _.uniq(counts.map(d => d.genre));
    const years = _.uniq(counts.map(d => d.year)).sort().slice(0, -1);

    const top3PerYear = _(counts)
        .groupBy("year")
        .flatMap(group => _.orderBy(group, ['count'], ['desc']).slice(0, 3))
        // .toArray()
        .value();

    // console.log("Top 3 Genres Per Year:", top3PerYear);
    const top3Genres = _.uniq(top3PerYear.map(d => d.genre));

    return {counts, genres, years, top3PerYear, top3Genres};
  }



  // progress is 100 by default unless specified
  let { movies, progress = 100, width = 500, height = 400 }: Props = $props();

  const movies_data = $derived(genreYearCountsList(movies));


  const lineData = $derived.by(() => {
    return _.map(movies_data.top3Genres, genre => {
      const points = _.map(movies_data.years, year => {
        const found = _.find(movies_data.top3PerYear, d => d.genre === genre && d.year === year);
        return {
          year,
          count: found ? found.count : null, // null if not in top 3 that year
          inTop3: !!found
        };
      });
      return { genre, points };
    });
  });



  // processing the data; $derived is used to create a reactive variable that updates whenever the dependent variables change
  const yearRange = $derived.by(() => {
    return [movies_data.years[0], movies_data.years[movies_data.years.length - 1]];
  });

  // drawing the time sereis chart

  const margin = {
    top: 15,
    bottom: 50,
    left: 50,
    right: 120,
  };

  let usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
  };

  const xScale = $derived(
    // tip: use d3.scaleBand() to create a band scale for the x-axis
    d3
      .scaleLinear()
      .range([usableArea.left, usableArea.right])
      .domain(yearRange)
      .nice(),
  );

  const yScale = $derived(
    // tip: use d3.scaleLinear() to create a linear scale for the y-axis
    d3
      .scaleLinear()
      .range([usableArea.bottom, usableArea.top])
      .domain([0, d3.max(movies_data?.top3PerYear?.map(d => d.count) || [0])!])
      .nice(),
  );
  const colorScale = $derived(
    d3.scaleOrdinal<string>()
      .domain(movies_data.top3Genres)
      .range(d3.schemeTableau10)
  );


  let xAxis: any = $state(),
    yAxis: any = $state();
  
  const line = $derived(
    d3.line<{ year: number; count: number | null }>()
      .defined(d => d.count !== null)
      .x(d => xScale(d.year))
      .y(d => yScale(d.count!))
      .curve(d3.curveMonotoneX)
  );

  function updateAxis() {
    d3.select(xAxis)
      .call(d3.axisBottom(xScale).tickFormat(d => String(d)));

    d3.select(yAxis)
      .call(d3.axisLeft(yScale).ticks(5))
      .call(g => g.selectAll(".tick line").clone()
          .attr("x2", usableArea.right - usableArea.left)
          .attr("stroke-opacity", 0.1));
  }

  // the $effect function is used to run a function whenever the reactive variables change, also known as a side effect
  $effect(() => {
    updateAxis();
    console.log("movies_data updated:", movies_data);

  });

  let container = $state(null);
 
  
</script>

<h3> Time Series Graph of top summer movie genres each year</h3>

{#if movies_data && lineData.length > 0}
  <svg {width} {height}>
    <g bind:this={yAxis} transform="translate({usableArea.left}, 0)" />

    <g class="lines">
      {#each lineData as {genre, points}}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <path
          d={line(points) || ""}
          fill ="none"
          stroke={colorScale(genre)}
          stroke-width={hoveredGenre === null || hoveredGenre === genre ? 2.5 : 1}
          opacity={hoveredGenre === null || hoveredGenre === genre ? 1: 0.2}
          onmouseenter={() => hoveredGenre = genre}
          onmouseleave={() => hoveredGenre = null}
        />
        {#each points as point}
          {#if point.inTop3 && point.count !== null}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <circle
              cx={xScale(point.year)}
              cy={yScale(point.count)}
              r={hoveredGenre === genre ? 5 : 3}
              fill={colorScale(genre)}
              opacity={hoveredGenre === null || hoveredGenre === genre ? 1 : 0.5}
              onmouseenter={() => hoveredGenre = genre}
              onmouseleave={() => hoveredGenre = null}

            >
            <title>{genre}: {point.count} movies in {point.year}</title>
            <!-- tip: the text below should change with the hover on interaction -->
            
            </circle>
          {/if}
        {/each}
        {/each}
        </g>
      <g bind:this={xAxis} transform="translate(0, {usableArea.bottom})" />
      <text
        transform="rotate(-90)"
        x={-(height / 2)}
        y={15}
        text-anchor="middle"
        font-size="12"
      >
        Number of Movies
      </text>

      <!-- legend for genre and its assoictaed color -->
      <g class="legend" transform="translate({usableArea.right + 10}, {margin.top})">
        {#each movies_data.top3Genres as genre, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            transform="translate(0, {i * 18})"
            onmouseenter={() => hoveredGenre = genre}
            onmouseleave={() => hoveredGenre = null}
            style="cursor: pointer"
            opacity={hoveredGenre === null || hoveredGenre === genre ? 1 : 0.5}
          >
            <rect width="12" height="12" fill={colorScale(genre)} />
            <text x="16" y="10" font-size="10">{genre}</text>
          </g>
        {/each}
      </g>
    </svg>
{/if}