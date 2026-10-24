# dashboard/views.py
from django.db.models import Avg, Count, Max, Min, Sum
from django.shortcuts import render

from cities.models import City
from regions.models import Region


def index(request):
    """Main dashboard view"""
    context = {
        'total_cities': City.objects.count(),
        'total_regions': Region.objects.count(),
        'countries': City.objects.values_list('country', flat=True).distinct().order_by('country'),
        'region_types': Region.objects.values_list('region_type', flat=True).distinct(),
        'city_types': [choice[0] for choice in City._meta.get_field('city_type').choices],
    }
    return render(request, 'dashboard/index.html', context)


def analytics(request):
    """Analytics page with detailed statistics"""
    city_queryset = City.objects.all()
    city_agg = city_queryset.aggregate(
        count=Count('id'),
        pop_sum=Sum('population'),
        pop_avg=Avg('population'),
        pop_max=Max('population'),
        pop_min=Min('population'),
        area_avg=Avg('urban_area_km2'),
    )
    city_stats = {
        'total_cities': city_agg['count'] or 0,
        'total_population': city_agg['pop_sum'] or 0,
        'avg_population': city_agg['pop_avg'] or 0,
        'max_population': city_agg['pop_max'] or 0,
        'min_population': city_agg['pop_min'] or 0,
        'avg_area': city_agg['area_avg'] or 0,
    }

    region_queryset = Region.objects.all()
    region_agg = region_queryset.aggregate(
        count=Count('id'),
        pop_sum=Sum('total_population'),
        pop_avg=Avg('total_population'),
        pop_max=Max('total_population'),
        pop_min=Min('total_population'),
        area_avg=Avg('area_km2'),
        gdp_avg=Avg('gdp_per_capita'),
    )
    region_stats = {
        'total_regions': region_agg['count'] or 0,
        'total_population': region_agg['pop_sum'] or 0,
        'avg_population': region_agg['pop_avg'] or 0,
        'max_population': region_agg['pop_max'] or 0,
        'min_population': region_agg['pop_min'] or 0,
        'avg_area': region_agg['area_avg'] or 0,
        'avg_gdp_per_capita': region_agg['gdp_avg'] or 0,
    }

    context = {
        'city_stats': city_stats,
        'region_stats': region_stats,
    }
    return render(request, 'dashboard/analytics.html', context)