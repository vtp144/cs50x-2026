from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0002_srs_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="cardprogress",
            name="difficulty_score",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddIndex(
            model_name="cardprogress",
            index=models.Index(
                fields=["user", "difficulty_score"], name="learning_ca_user_id_diff_idx"
            ),
        ),
    ]
