from django.contrib.gis.geos import Point
from rest_framework import status
from rest_framework.test import APITestCase

from .models import City

NEAREST_URL = "/api/cities/nearest/"
RADIUS_URL = "/api/cities/radius/"

DUBLIN = {"lat": 53.3498, "lng": -6.2603}

# name, country, lat, lng
TEST_CITIES = [
    ("Dublin", "Ireland", 53.3498, -6.2603),
    ("London", "United Kingdom", 51.5074, -0.1278),
    ("Amsterdam", "Netherlands", 52.3676, 4.9041),
    ("Brussels", "Belgium", 50.8503, 4.3517),
    ("Paris", "France", 48.8566, 2.3522),
    ("Berlin", "Germany", 52.5200, 13.4050),
    ("Prague", "Czech Republic", 50.0755, 14.4378),
    ("Vienna", "Austria", 48.2082, 16.3738),
    ("Madrid", "Spain", 40.4168, -3.7038),
    ("Lisbon", "Portugal", 38.7223, -9.1393),
    ("Rome", "Italy", 41.9028, 12.4964),
    ("Athens", "Greece", 37.9838, 23.7275),
]


class ProximitySearchAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        for name, country, lat, lng in TEST_CITIES:
            City.objects.create(
                name=name,
                country=country,
                region="Test region",
                population=100000,
                location=Point(lng, lat, srid=4326),
                is_capital=True,
                timezone="UTC",
            )

    # ----- Nearest: valid -----
    def test_nearest_returns_ten_sorted_results(self):
        response = self.client.post(NEAREST_URL, DUBLIN, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cities = response.data["nearest_cities"]
        self.assertEqual(response.data["total_found"], 10)
        self.assertEqual(len(cities), 10)

        distances = [c["distance_km"] for c in cities]
        self.assertEqual(distances, sorted(distances))
        self.assertEqual(cities[0]["name"], "Dublin")
        self.assertEqual(cities[0]["distance_km"], 0.0)
        self.assertEqual(cities[1]["name"], "London")
        self.assertEqual([c["rank"] for c in cities], list(range(1, 11)))

    def test_nearest_results_come_from_city_table(self):
        response = self.client.post(NEAREST_URL, DUBLIN, format="json")
        db_ids = set(City.objects.values_list("id", flat=True))
        for city in response.data["nearest_cities"]:
            self.assertIn(city["id"], db_ids)

    # ----- Radius: valid -----
    def test_radius_returns_only_cities_inside(self):
        payload = {**DUBLIN, "radius_km": 500}
        response = self.client.post(RADIUS_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [c["name"] for c in response.data["cities"]]
        self.assertEqual(names, ["Dublin", "London"])
        self.assertEqual(response.data["total_found"], 2)
        for city in response.data["cities"]:
            self.assertLessEqual(city["distance_km"], 500)

    def test_radius_larger_distance_sorted(self):
        payload = {**DUBLIN, "radius_km": 1000}
        response = self.client.post(RADIUS_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        distances = [c["distance_km"] for c in response.data["cities"]]
        self.assertEqual(distances, sorted(distances))
        self.assertTrue(all(d <= 1000 for d in distances))
        self.assertNotIn("Berlin", [c["name"] for c in response.data["cities"]])

    def test_radius_defaults_to_100_km(self):
        response = self.client.post(RADIUS_URL, DUBLIN, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["radius_km"], 100)
        self.assertEqual([c["name"] for c in response.data["cities"]], ["Dublin"])

    # ----- Invalid coordinate ranges -----
    def test_invalid_latitude_rejected(self):
        for lat in (91, -91):
            response = self.client.post(
                NEAREST_URL, {"lat": lat, "lng": -6.26}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("error", response.data)

    def test_invalid_longitude_rejected(self):
        for lng in (181, -181):
            response = self.client.post(
                RADIUS_URL, {"lat": 53.35, "lng": lng, "radius_km": 100}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ----- Missing / non-numeric input -----
    def test_missing_coordinates_rejected(self):
        for payload in ({}, {"lat": 53.35}, {"lng": -6.26}):
            for url in (NEAREST_URL, RADIUS_URL):
                response = self.client.post(url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_numeric_coordinates_rejected(self):
        for payload in ({"lat": "abc", "lng": -6.26}, {"lat": 53.35, "lng": None}):
            response = self.client.post(NEAREST_URL, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ----- Invalid radius -----
    def test_invalid_radius_rejected(self):
        for radius in (0, -5, 20001, "abc"):
            payload = {**DUBLIN, "radius_km": radius}
            response = self.client.post(RADIUS_URL, payload, format="json")
            self.assertEqual(
                response.status_code, status.HTTP_400_BAD_REQUEST,
                msg=f"radius_km={radius!r} should be rejected",
            )

    # ----- Method -----
    def test_get_not_allowed(self):
        self.assertEqual(
            self.client.get(NEAREST_URL).status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )