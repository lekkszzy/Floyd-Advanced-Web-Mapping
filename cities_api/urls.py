from django.urls import path
from . import views

app_name = 'cities_api'

urlpatterns = [
    path('', views.CityListCreateView.as_view(), name='city-list-create'),
    path('<int:pk>/', views.CityDetailView.as_view(), name='city-detail'),

    path('geojson/', views.CityGeoJSONView.as_view(), name='city-geojson'),

    path('within-radius/', views.cities_within_radius, name='cities-within-radius'),
    path('bbox/', views.cities_in_bounding_box, name='cities-bbox'),

    path('stats/', views.city_statistics, name='city-statistics'),
    path('countries/', views.countries_list, name='countries-list'),
    path('info/', views.api_info, name='api-info'),
]