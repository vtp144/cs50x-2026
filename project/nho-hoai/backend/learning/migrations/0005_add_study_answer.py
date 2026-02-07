import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [
        ("learning", "0004_merge_20260206_1136"),
    ]

    operations = [
        migrations.CreateModel(
            name="StudyAnswer",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("is_correct", models.BooleanField()),
                ("answered_at", models.DateTimeField(default=timezone.now)),
                (
                    "card",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="study_answers",
                        to="learning.card",
                    ),
                ),
                (
                    "session",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="answers",
                        to="learning.studysession",
                    ),
                ),
            ],
            options={
                "ordering": ["answered_at"],
            },
        ),
        migrations.AddIndex(
            model_name="studyanswer",
            index=models.Index(
                fields=["session", "card"], name="learning_stu_session_8d7f58_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="studyanswer",
            index=models.Index(
                fields=["session", "answered_at"],
                name="learning_stu_session_5a1f43_idx",
            ),
        ),
    ]
