<script lang="ts">
  import * as d3 from "d3";
  import { onMount } from "svelte";
  import type { TMovie } from "../../types";
  import Bar from "$lib/Bar.svelte";
  import TimeSeries from "$lib/TimeSeries.svelte";
  import Matrix from "$lib/Matrix.svelte";


  // Reactive variable for storing the data
  let movies: TMovie[] = [];

  // Function to load the CSV
  async function loadCsv() {
    try {
      const csvUrl = "./summer_movies.csv";
      movies = await d3.csv(csvUrl, (row) => {
        // TIP: in row, all values are strings, so we need to use a row conversion function here to format them
        // translate the date to utc
        return {
          ...row, // spread syntax to copy all properties from rownum_votes: number;
          num_votes: Number(row.num_votes),
          year: Number(row.year),
          runtime_minutes: Number(row.runtime_minutes),
          genres: (row.genres.split(',')),
          average_rating: Number(row.average_rating)

          // please also format the values for other non-string attributes. You can check the attributes in the CSV file
        };
      });

      console.log("Loaded CSV Data:", movies);
    } catch (error) {
      console.error("Error loading CSV:", error);
    }
  }
  // Call the loader when the component mounts
  onMount(loadCsv);
</script>

<h1>Summear Movies</h1>

<p>Here are {movies.length == 0 ? "..." : movies.length + " "} movies</p>
<Bar {movies} />

<p>Q1: How do the annual top 3 genres change over time? For example, which genre is always within the top3? Note: the annual top 3 genres are based on the number of movies released that year.</p>
<TimeSeries {movies} />
<Matrix {movies} />