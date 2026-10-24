# cities/management/commands/populate_all_data.py
from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Populate all European mapping data (cities and regions)'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear all existing data before populating')
        parser.add_argument('--cities', type=int, default=100, help='Number of cities to create (default: 100)')
        parser.add_argument('--regions', type=int, default=50, help='Number of regions to create (default: 50)')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting European mapping data population...\n'))

        self.stdout.write('Populating regions...')
        call_command('populate_regions', clear=options['clear'], count=options['regions'], verbosity=1)

        self.stdout.write('\nPopulating cities...')
        call_command('populate_cities', clear=options['clear'], count=options['cities'], verbosity=1)

        self.stdout.write(self.style.SUCCESS(
            f'\nData population complete!'
            f'\n   Cities: {options["cities"]}'
            f'\n   Regions: {options["regions"]}'
            f'\n\nDashboard: http://localhost:8000/'
            f'\nAPI:       http://localhost:8000/api/'
            f'\nAdmin:     http://localhost:8000/admin/'
        ))