Lab 3 report

for part 1 I was working with working API app with endpoints. All 9 endpoints in cities_api/urls.py. I extended requirements.txt with the new API packages. I then updated the hello_map/settings.py to register new apps.. Finally, I created data/cities_data.py with 20 real-world cities (name, country, coordinates, population, founding year, etc.) as the seed data the API would serve.

For Part 2 I had built the actual data model the API is built around. I created the cities_api/models.py with a city model holding name, country, region, population, founding_year, capital, status, timezone, elevation and the cities coordinates.I then ran make migrations and migrate to create the table in PostGIS, and wrote a management command, load_cities.py, that reads cities_data.py and bulk-creates or updates City rows from it — converting each city's latitude/longitude into a proper PostGIS Point. Running that command loaded all 20 cities into the database successfully.

Part 3. 