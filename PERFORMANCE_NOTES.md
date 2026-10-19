# Lab 5 – Proximity Search Performance Note

## Environment
- Docker Compose: Django (python:3.12-slim) + PostGIS 16-3.4, Windows host
- Dataset: 20 cities in `cities_api_city`

## Spatial index
`\d cities_api_city` shows a single GiST index on the geometry column:
`cities_api_city_location_5e706dd4_id gist (location)`.
It is created by GeoDjango's default `spatial_index=True`; no duplicate index was added.

## Query plan (nearest 10 to Dublin, EXPLAIN ANALYZE)
```
Limit (actual time=13.524..13.527 rows=10)
  -> Sort  Sort Key: st_distance(geography(location), <Dublin>::geography, false)
           Sort Method: quicksort  Memory: 30kB
     -> Seq Scan on cities_api_city (rows=20)
           Filter: (location IS NOT NULL)
Planning Time: 0.914 ms
Execution Time: 13.577 ms   (first, cold run)
```

**The spatial index does not appear in the plan.** PostgreSQL performs a sequential scan,
computes the distance for every row, then sorts and returns the top 10. Two reasons:
1. With only 20 rows, a sequential scan is cheaper than an index lookup, so the planner ignores the index.
2. `Distance()` on an SRID 4326 field casts the column to `geography` for an accurate distance in metres.
   Ordering by a computed `ST_Distance` value cannot use the GiST index; only the KNN `<->` operator
   (index-assisted ORDER BY) can. On a large table, a bounding pre-filter or KNN ordering would be needed
   for the index to be used.

## Timings (nearest-10 query, average of 50 runs after warm-up)

| Test point | Before (all fields) | After (`.only()`) |
|------------|--------------------:|------------------:|
| Dublin     | 1.80 ms | 1.53 ms |
| London     | 1.83 ms | 1.98 ms |
| Berlin     | 1.61 ms | 1.68 ms |
| Madrid     | 1.91 ms | 1.66 ms |
| **Average**| **1.79 ms** | **1.71 ms** |

Restricting the selected columns with `.only("id", "name", "country", "population", "location")`
returned identical results in identical order. The ~0.08 ms difference is within measurement noise:
with 20 rows, retrieving the unused columns has negligible cost. The benefit would be greater on a large
table with wide text columns. Timings depend on dataset size and the local Docker environment.

## Tests
`docker compose run --rm web python manage.py test cities_api` → 18 tests, all passing
(valid nearest/radius requests, invalid coordinate ranges, missing and non-numeric input, invalid radius).