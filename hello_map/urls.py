from django.contrib import admin
from django.urls import path
from mapping.views import map_view

urlpatterns = [
    path('', map_view, name='map'),
    path('admin/', admin.site.urls),
]