# tests/test_api_endpoints.py
import json
import requests


class EuropeanMappingAPITester:
    def __init__(self, base_url='http://localhost:8000'):
        self.base_url = base_url
        self.session = requests.Session()

    def test_server_connectivity(self):
        print("Testing server connectivity...")
        try:
            response = self.session.get(self.base_url, timeout=5)
            print(f"  Server accessible: HTTP {response.status_code}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"  Server not accessible: {e}")
            return False

    def test_cities_endpoint(self):
        print("\nTesting Cities Endpoint...")
        try:
            response = self.session.get(f'{self.base_url}/api/cities/')
            print(f"Status Code: {response.status_code}")
            if response.status_code != 200:
                print(f"  Expected 200, got {response.status_code}")
                print(f"  Response: {response.text[:500]}")
                return False

            data = response.json()
            if not isinstance(data, dict) or data.get('type') != 'FeatureCollection':
                print(f"  Expected FeatureCollection, got {data.get('type') if isinstance(data, dict) else type(data)}")
                return False

            features = data.get('features', [])
            print(f"Number of features: {len(features)}")
            if not features:
                print("  No cities in database yet")
                return True

            feature = features[0]
            for key in ['type', 'geometry', 'properties']:
                if key not in feature:
                    print(f"  Missing required key: {key}")
                    return False

            geom = feature['geometry']
            if geom['type'] != 'Point':
                print(f"  Expected Point geometry, got {geom['type']}")
                return False
            if not isinstance(geom['coordinates'], list) or len(geom['coordinates']) != 2:
                print(f"  Invalid coordinates: {geom['coordinates']}")
                return False

            props = feature['properties']
            for prop in ['name', 'country', 'population']:
                if prop not in props:
                    print(f"  Missing required property: {prop}")
                    return False

            print("  Cities endpoint working correctly")
            print(f"  Sample city: {props['name']}, {props['country']} (Pop: {props['population']:,})")
            return True

        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            print(f"  Error: {e}")
            return False

    def test_regions_endpoint(self):
        print("\nTesting Regions Endpoint...")
        try:
            response = self.session.get(f'{self.base_url}/api/regions/')
            print(f"Status Code: {response.status_code}")
            if response.status_code != 200:
                print(f"  Response: {response.text[:500]}")
                return False

            data = response.json()
            if not isinstance(data, dict) or data.get('type') != 'FeatureCollection':
                print("  Expected FeatureCollection")
                return False

            features = data.get('features', [])
            print(f"Number of features: {len(features)}")
            if not features:
                print("  No regions in database yet")
                return True

            feature = features[0]
            if feature['geometry']['type'] != 'MultiPolygon':
                print(f"  Expected MultiPolygon geometry, got {feature['geometry']['type']}")
                return False

            props = feature['properties']
            print("  Regions endpoint working correctly")
            print(f"  Sample region: {props.get('name')}, {props.get('country')}")
            return True

        except Exception as e:
            print(f"  Error testing regions: {e}")
            return False

    def test_statistics_endpoints(self):
        print("\nTesting Statistics Endpoints...")
        success = True
        for endpoint in ['/api/cities/statistics/', '/api/regions/statistics/']:
            try:
                response = self.session.get(f'{self.base_url}{endpoint}')
                print(f"{endpoint}: HTTP {response.status_code}")
                if response.status_code == 200:
                    print(f"  Stats keys: {list(response.json().keys())}")
                else:
                    print(f"  Failed: {response.text[:200]}")
                    success = False
            except Exception as e:
                print(f"  Error: {e}")
                success = False
        return success

    def test_filtering(self):
        print("\nTesting Filtering...")
        success = True
        test_filters = [
            ('population_min=100000', 'Population filter'),
            ('country=Germany', 'Country filter'),
            ('city_type=capital', 'City type filter'),
        ]
        for filter_param, description in test_filters:
            try:
                response = self.session.get(f'{self.base_url}/api/cities/?{filter_param}')
                if response.status_code == 200:
                    count = len(response.json().get('features', []))
                    print(f"  {description}: {count} results")
                else:
                    print(f"  {description} failed: HTTP {response.status_code}")
                    success = False
            except Exception as e:
                print(f"  {description} error: {e}")
                success = False
        return success

    def test_proximity_and_bounds(self):
        print("\nTesting Nearby and Bounding Box...")
        success = True

        r = self.session.get(f'{self.base_url}/api/cities/nearby/?lat=53.3498&lng=-6.2603&distance=500')
        print(f"  nearby (500 km of Dublin): HTTP {r.status_code}, {len(r.json().get('features', []))} results")
        success &= r.status_code == 200

        r = self.session.get(f'{self.base_url}/api/cities/nearby/')
        print(f"  nearby without params: HTTP {r.status_code} (expected 400)")
        success &= r.status_code == 400

        r = self.session.post(
            f'{self.base_url}/api/cities/within_bounds/',
            json={'west': -11, 'south': 50, 'east': 2, 'north': 59}
        )
        print(f"  within_bounds (IE/UK): HTTP {r.status_code}, {len(r.json().get('features', []))} results")
        success &= r.status_code == 200

        return bool(success)

    def run_all_tests(self):
        print("Starting European Mapping API Tests")
        print("=" * 50)

        if not self.test_server_connectivity():
            print("Server not accessible. Run: docker compose up -d web")
            return False

        results = {
            'cities': self.test_cities_endpoint(),
            'regions': self.test_regions_endpoint(),
            'statistics': self.test_statistics_endpoints(),
            'filtering': self.test_filtering(),
            'proximity_bounds': self.test_proximity_and_bounds(),
        }

        print("\n" + "=" * 50)
        print("Test Results Summary:")
        for name, result in results.items():
            print(f"  {name.title()}: {'PASS' if result else 'FAIL'}")

        passed = sum(results.values())
        print(f"\nOverall: {passed}/{len(results)} tests passed")
        return passed == len(results)


if __name__ == "__main__":
    EuropeanMappingAPITester().run_all_tests()