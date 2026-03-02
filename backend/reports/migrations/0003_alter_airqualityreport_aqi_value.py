from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0002_airqualityreport_device_info"),
    ]

    operations = [
        migrations.AlterField(
            model_name="airqualityreport",
            name="aqi_value",
            field=models.FloatField(blank=True, null=True),
        ),
    ]
