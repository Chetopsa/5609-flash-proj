<script lang="ts">
    import type { TMovie_A2 } from "../types";
    import * as d3 from "d3";


    type TProps = {
        movies: TMovie_A2[];
        x: keyof TMovie_A2;
        y: keyof TMovie_A2;
        size?: keyof TMovie_A2;
        width?: number;
        height?: number;
    };
    const { movies, x, y, size, height = 500, width = 600 }: TProps = $props();

    let selectedMovie: TMovie_A2 | undefined = $state();

    const margin = {
        top: 15,
        bottom: 50,
        left: 30,
        right: 10,
    };
    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
    };
    const sizeRange = [3, 15];

    function getScale(
        attrName: keyof TMovie_A2,
        axis: "x" | "y" | "color" | "size",
        movies: TMovie_A2[],
    ) {
        if (movies.length == 0) {
            return null;
        }

        let range: number[] = [0, 0];
        if (axis == "x") {
            range = [usableArea.left, usableArea.right];
        } else if (axis == "y") {
            range = [usableArea.bottom, usableArea.top];
        } else if (axis == "size") {
            range = sizeRange;
        }
        

        if (typeof movies[0][attrName] == "string") {
            return d3
                .scaleBand()
                .domain(movies.map((d) => d[attrName] as string))
                .range(range);
        } else if (typeof movies[0][attrName] == "number") {
            return d3
                .scaleLinear()
                .domain(
                    d3.extent(movies, (d) => d[attrName] as number) as [
                        number,
                        number,
                    ],
                )
                .range(range);
        } else if (movies[0][attrName] instanceof Date) {
            // date
            return d3
                .scaleTime()
                .domain(
                    d3.extent(movies, (d) => d[attrName] as Date) as [Date, Date]
                )
                .range(range);
        } else if (typeof movies[0][attrName] == "object") {
            // array
            let allValues = movies
                .map((d) => d[attrName] as string[])
                .reduce((acc, val) => acc.concat(val), []);
            return d3
                .scaleBand()
                .domain([...new Set(allValues)])
                .range(range);
        } else {
            return null;
        }
    }

    const xScale = $derived(getScale(x, "x", movies));
    const yScale = $derived(getScale(y, "y", movies));
    const sizeScale = $derived(size ? getScale(size, "size", movies) : null);

    let xAxis: any = $state(),
        yAxis: any = $state();

    function updateAxis() {
        if (!xScale || !yScale) {
            return;
        }
        
        d3.select(xAxis)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .attr("transform", "rotate(45)")
            .style("text-anchor", "start");

        d3.select(yAxis).call(d3.axisLeft(yScale));
    }

    function handleMovieClick(movie: TMovie_A2) {
        // tip1: update the selectedMovie variable
        if (selectedMovie == movie) {
            selectedMovie = undefined;

        } else {
            selectedMovie = movie;
        }
    }

    // the $effect function is used to run a function whenever the reactive variables change, also known as a side effect
    $effect(() => {
        updateAxis();
    });
</script>

<svg {width} {height}>
    <g class="points">
        {#each movies as movie}
            {#if x == "genres"}
                {#each movie["genres"] as genre}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <circle
                        cx={xScale ? xScale(genre) : usableArea.left}
                        cy={yScale ? yScale(movie[y]) : usableArea.bottom}
                        r={sizeScale ? sizeScale(movie[size]) : sizeRange[0]}
                        fill={movie == selectedMovie
                            ? "steelblue"
                            : "transparent"}
                        stroke="steelblue"
                        stroke-width="2"
                        opacity={movie == selectedMovie ? 1 : 0.5}
                        onclick={() => handleMovieClick(movie)}
                    />
                {/each}
            {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle
                    cx={xScale ? xScale(movie[x]) : usableArea.left}
                    cy={yScale ? yScale(movie[y]) : usableArea.bottom}
                    r={sizeScale ? sizeScale(movie[size]) : sizeRange[0]}
                    fill={movie == selectedMovie ? "steelblue" : "transparent"}
                    stroke="steelblue"
                    stroke-width="2"
                    opacity={movie == selectedMovie ? 1 : 0.5}
                    onclick={() => handleMovieClick(movie)}
                />
            {/if}
        {/each}
    </g>
    <g transform="translate(0, {usableArea.bottom})" bind:this={xAxis} />
    <g transform="translate({usableArea.left}, 0)" bind:this={yAxis} />
</svg>
<div class="selectedInfo">
    {selectedMovie
        ? JSON.stringify(selectedMovie, null, 2)
        : "Click on a point to see details"}
</div>

<style>
    /* add animation when the point transit */
    .points circle {
        transition:
            r 0.5s,
            cx 0.5s,
            cy 0.5s;
        cursor: pointer;
    }

    svg {
        display: inline-block; /* Ensures SVG appears inline with the div */
        vertical-align: top; /* Aligns SVG to the top of the div */
    }

    .selectedInfo {
        display: inline-block; /* Ensures div appears inline with SVG */
        vertical-align: top; /* Aligns div to the top of SVG */
        width: 250px; /* Set a fixed width for the div */
        color: #555;
        font-family: monospace;
        white-space: pre-wrap; /* Preserve formatting of JSON */
        background-color: #f9f9f9;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: auto; /* Add scroll if the content overflows */
    }
</style>
