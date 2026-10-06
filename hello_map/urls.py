from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('spatial/', include('spatial_analysis.urls')),

    # Lab 4: Leaflet map (before the '' include)
    path('map/', TemplateView.as_view(template_name='map.html'), name='leaflet_map'),

    # Week 1 mapping app
    path('', include('mapping.urls')),

    # API endpoints
    path('api/cities/', include('cities_api.urls')),

    # API documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)