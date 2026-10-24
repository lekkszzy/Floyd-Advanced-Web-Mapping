# Lab 6 – Results (Tasks 1–3)

## API test run

```
$ docker compose exec web python tests/test_api_endpoints.py

Testing server connectivity...        HTTP 200
Cities endpoint:   200, 100 features  – PASS
Regions endpoint:  200, 50 features   – PASS
Statistics:        /api/cities/statistics/ 200, /api/regions/statistics/ 200 – PASS
Filtering:         population_min=100000 → 98, country=Germany → 15, city_type=capital → 19 – PASS
Proximity/bounds:  nearby 500 km of Dublin → 10; nearby without params → 400; within_bounds IE/UK → 12 – PASS

Overall: 5/5 tests passed
```

## Task 1 – Layer geometry types and filter counts

`/api/cities/` returns **Point** features and `/api/regions/` returns **MultiPolygon** features.

| Query | Features |
|---|---|
| `/api/cities/` (no filter) | 100 |
| `/api/cities/?population_min=500000` | 68 |
| `/api/cities/?country=Germany&city_type=major&population_min=500000` | 13 |
| `/api/regions/` (no filter) | 50 |
| `/api/regions/?area_min=10000&country=Germany` | 7 |

Each filter reduces the result set, and combined filters are applied together (AND), narrowing it further. Counts can vary slightly between runs because the extra `City_XXXX` / `Region_XXXX` records are randomly generated.

## Task 2 – Dashboard

- Selecting **Germany** with a city population minimum of **500,000** and clicking **Apply Filters** reduced the map to 14 cities and 8 regions, and the total population updated.
- **Clear All** restored the full data (100 cities, 50 regions).
- The export buttons downloaded `cities_export.geojson`, `regions_export.geojson` and `statistics_export.json`; the GeoJSON files are `FeatureCollection` objects with `type`, `geometry` and `properties` on each feature.
- The analytics page shows values in every field (e.g. 100 cities, 50 regions, average regional GDP per capita €42,752).

## Task 3 – PostGIS verification and spatial indexes

```
PostGIS version:  3.4 USE_GEOS=1 USE_PROJ=1 USE_STATS=1
cities_city:      100 rows, total population 86,271,874
regions_region:   50 rows
Largest cities:   London POINT(-0.1278 51.5074), Berlin POINT(13.405 52.52), Madrid POINT(-3.7038 40.4168)
Region geometry:  MULTIPOLYGON, SRID 4326
```

| Table | Geometry column | Spatial (GiST) index |
|---|---|---|
| `cities_city` | `location` (Point, 4326) | `cities_city_location_34cfe5d6_id` |
| `regions_region` | `geometry` (MultiPolygon, 4326) | `regions_region_geometry_77791ffd_id` |
| `regions_region` | `centroid` (Point, 4326) | `regions_region_centroid_ec4d40c4_id` |

Django creates these automatically for geometry fields using PostGIS's GiST access method.

**Why a GiST index helps:** a GiST index stores each geometry's bounding box in an R-tree. A spatial query first uses the index to find only the candidates whose boxes overlap the search area, and runs the exact (more expensive) geometry test on those few rows, instead of scanning and testing every row in the table.

- **Nearby endpoint:** `location__distance_lte` is translated to `ST_DWithin`, which uses the index to discard every city outside the search radius's bounding box before computing exact distances.
- **Bounding-box queries:** the index finds geometries whose boxes intersect the query box directly, so the cost grows roughly logarithmically rather than linearly with table size.
- **Note:** the `within_bounds` endpoint as written filters on the plain `latitude`/`longitude` float columns, so it cannot use the GiST index. Rewriting it as `location__within=Polygon.from_bbox((west, south, east, north))` would let PostGIS use the spatial index.

## Fixes applied to the lab sheet

- `index.html` used `cartoLayer` without defining it; added the tile layer definition.
- `nearby` passed metres as a plain number, which PostGIS read as degrees; changed to `D(m=distance_m)`.
- Map tiles returned 403 because Django's default referrer policy (`same-origin`) sent no `Referer`; set `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"` and `referrerPolicy` on the tile layers.
- Analytics aggregate aliases clashed with the `total_population` field; renamed the aliases.