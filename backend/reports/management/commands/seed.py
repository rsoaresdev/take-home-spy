"""
    python manage.py seed          # Inserts demo data (skips if already present)
    python manage.py seed --flush  # Clears ALL reports first, then re-seeds
"""

import random
from datetime import datetime, timedelta, timezone
from django.core.management.base import BaseCommand
from reports.models import AirQualityReport

# ---------------------------------------------------------------------------
# Ribeira → Clérigos → Bonfim → Campanhã area
# ---------------------------------------------------------------------------
PORTO_TRAJECTORY = [
    # Ribeira / Cais da Ribeira
    (41.14082, -8.61394),
    (41.14098, -8.61320),
    (41.14115, -8.61241),
    (41.14143, -8.61158),
    # Largo de São Domingos
    (41.14202, -8.61073),
    (41.14260, -8.61005),
    (41.14322, -8.60942),
    # Praça da Liberdade
    (41.14381, -8.60884),
    (41.14430, -8.60855),
    (41.14472, -8.60825),
    # Avenida dos Aliados
    (41.14510, -8.60808),
    (41.14553, -8.60793),
    (41.14595, -8.60780),
    (41.14638, -8.60769),
    # Torre dos Clérigos
    (41.14593, -8.61453),
    (41.14555, -8.61482),
    (41.14520, -8.61512),
    (41.14487, -8.61540),
    # Bairro Miguel Bombarda (galerias de arte)
    (41.14458, -8.61579),
    (41.14423, -8.61618),
    (41.14390, -8.61648),
    (41.14357, -8.61678),
    # Museu Soares dos Reis
    (41.14325, -8.61715),
    (41.14293, -8.61742),
    (41.14258, -8.61768),
    # Rotunda da Boavista (heading east back)
    (41.14228, -8.61795),
    (41.14200, -8.61820),
    # Praça de Carlos Alberto
    (41.14525, -8.61870),
    (41.14560, -8.61852),
    (41.14592, -8.61835),
    # Rua de Santa Catarina
    (41.14635, -8.61710),
    (41.14670, -8.61655),
    (41.14702, -8.61598),
    (41.14730, -8.61540),
    # Bonfim
    (41.14760, -8.61480),
    (41.14795, -8.61418),
    (41.14825, -8.61355),
    (41.14858, -8.61292),
    (41.14890, -8.61230),
    (41.14918, -8.61170),
    # Estação de Campanhã (final)
    (41.14950, -8.61108),
    (41.14978, -8.61048),
    (41.15005, -8.60985),
    (41.15030, -8.60922),
    (41.15055, -8.60860),
]

DEVICE_ID = "demo-porto-agent-001"
DEVICE_INFO = {
    "model": "iPhone 15 Pro",
    "os": "iOS 17.4",
    "app_version": "1.0.0",
    "description": "Seeded demo agent - Porto city-centre walk",
}


class Command(BaseCommand):
    help = "Populate the DB with 45 demo telemetry pings from Porto city centre"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete ALL existing reports before seeding",
        )

    def handle(self, *args, **options):
        if options["flush"]:
            deleted, _ = AirQualityReport.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Deleted {deleted} existing reports."))

        # Skip if demo data already present
        if AirQualityReport.objects.filter(device_id=DEVICE_ID).exists():
            self.stdout.write(
                self.style.NOTICE(
                    f"Seed data already present for device '{DEVICE_ID}'. "
                    "Run with --flush to re-seed."
                )
            )
            return

        # Generate pings spread over the last 2 hours
        now = datetime.now(tz=timezone.utc)
        interval_minutes = 120 / len(PORTO_TRAJECTORY)

        reports = []
        for i, (lat, lon) in enumerate(PORTO_TRAJECTORY):
            ts = now - timedelta(minutes=(len(PORTO_TRAJECTORY) - i) * interval_minutes)
            # Realistic European AQI for Porto: 28–55 µg/m³
            aqi = round(random.uniform(28, 55), 1)
            reports.append(
                AirQualityReport(
                    device_id=DEVICE_ID,
                    device_info=DEVICE_INFO,
                    latitude=lat,
                    longitude=lon,
                    aqi_value=aqi,
                    created_at=ts,
                )
            )

        AirQualityReport.objects.bulk_create(reports)

        self.stdout.write(
            self.style.SUCCESS(
                f"✅ Seeded {len(reports)} demo pings for device '{DEVICE_ID}'.\n"
                f"   Trajectory: Ribeira → Clérigos → Bonfim → Campanhã (Porto)\n"
                f"   Open the dashboard to visualize."
            )
        )
