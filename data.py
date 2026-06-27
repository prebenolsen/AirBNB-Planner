"""
Standarddata for AirBNB-planleggeren.
Denne filen brukes av generate.py for aa lage data.js.
"""

categories = [
    "Bad",
    "Soverom",
    "Gang",
    "Stue",
    "Kjøkken",
    "Bod",
    "Alle rom",
]

days = [
    "7 dager før gjester ankommer",
    "6 dager før gjester ankommer",
    "5 dager før gjester ankommer",
    "4 dager før gjester ankommer",
    "3 dager før gjester ankommer",
    "2 dager før gjester ankommer",
    "1 dag før gjester ankommer",
    "Ankomstdag",
]

priorities = ["Kritisk", "Normal", "Valgfri"]

tasks = []

task_id = 1
order = 1


def add_task(title, category, day, priority="Normal", notes="", assignee=""):
    global task_id, order

    tasks.append(
        {
            "id": f"task-{task_id:03}",
            "title": title,
            "category": category,
            "day": day,
            "priority": priority,
            "completed": False,
            "notes": notes,
            "assignee": assignee,
            "order": order,
        }
    )

    task_id += 1
    order += 1


# Kjøkken
add_task("Rydd kjøleskap", "Kjøkken", "2 dager før gjester ankommer", assignee="Meg")
add_task("Rydd fryser", "Kjøkken", "2 dager før gjester ankommer", assignee="Meg")
add_task("Rydd kjøkkenskap", "Kjøkken", "2 dager før gjester ankommer")
add_task("Tøm oppvaskmaskin", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask kjøleskap", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask fryser", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask kjøkkenskap", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask overflater (inkl. skapdører)", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask kjøkkenutstyr (skuff 1 og 2)", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask fat og skåler", "Kjøkken", "1 dag før gjester ankommer")
add_task("Vask kaffemaskin", "Kjøkken", "1 dag før gjester ankommer", notes="Rensevæske under vasken")
add_task("Vask airfryer", "Kjøkken", "1 dag før gjester ankommer")


# Stue
add_task("Rydd", "Stue", "2 dager før gjester ankommer")
add_task("Vask gulv", "Stue", "1 dag før gjester ankommer")
add_task("Vask overflater (bord, benker, vinduskarmer og pult)", "Stue", "1 dag før gjester ankommer")
add_task("Vask vinduer (ved behov)", "Stue", "1 dag før gjester ankommer")
add_task("Støvsug sofa", "Stue", "1 dag før gjester ankommer")


# Gang
add_task("Rydd", "Gang", "3 dager før gjester ankommer")
add_task("Vask gulv", "Gang", "1 dag før gjester ankommer")
add_task("Vask overflater", "Gang", "1 dag før gjester ankommer")


# Soverom
add_task("Rydd", "Soverom", "2 dager før gjester ankommer")
add_task("Vask gulv", "Soverom", "1 dag før gjester ankommer")
add_task("Vask overflater", "Soverom", "1 dag før gjester ankommer")
add_task("Vask vinduer (ved behov)", "Soverom", "1 dag før gjester ankommer")


# Bad
add_task("Rydd", "Bad", "2 dager før gjester ankommer")
add_task("Rydd skap", "Bad", "2 dager før gjester ankommer")
add_task("Rydd skap under vask", "Bad", "2 dager før gjester ankommer")
add_task("Vask gulv", "Bad", "1 dag før gjester ankommer")
add_task("Vask toalett", "Bad", "1 dag før gjester ankommer")
add_task("Vask servant", "Bad", "1 dag før gjester ankommer")
add_task("Vask skap", "Bad", "1 dag før gjester ankommer")
add_task("Vask oppbevaringshylle", "Bad", "1 dag før gjester ankommer")
add_task("Vask dusjområde", "Bad", "1 dag før gjester ankommer")
add_task("Steam dusjområde", "Bad", "1 dag før gjester ankommer")
add_task("Vask dusjforheng", "Bad", "1 dag før gjester ankommer")
add_task("Fyll opp toalettsaker", "Bad", "1 dag før gjester ankommer")


# Bod
add_task(
    "Fjern private klær",
    "Bod",
    "2 dager før gjester ankommer",
    assignee="Meg"
)

add_task(
    "Fjern verdisaker (alkohol, penger, nøkler, utility closet)",
    "Bod",
    "2 dager før gjester ankommer",
    priority="Kritisk",
    assignee="Meg"
)

