FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for GIS (GDAL, GEOS, PROJ) and build tools
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        binutils \
        build-essential \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
        gdal-data \
    && rm -rf /var/lib/apt/lists/*

# Install GDAL Python bindings matching the installed GDAL version
RUN pip install --no-cache-dir GDAL==$(gdal-config --version)

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Expose Django port
EXPOSE 8000

# Default command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]