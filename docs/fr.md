# SMHI

Les prévisions météo officielles de l'**Institut météorologique et
hydrologique suédois (SMHI)** dans Gladys : valeurs actuelles, prévisions
heure par heure et jour par jour, et les avertissements météo du SMHI pour la
Suède. Données publiques, sans compte ni clé d'API.

> Sans lien avec le SMHI. Développée sans test réel contre le SMHI : vos
> retours sont les bienvenus sur le forum Gladys.

## Ce que fait l'intégration

- **Un appareil par lieu** : chaque maison localisée de Gladys, plus, en
  option, un lieu donné par ses coordonnées (un chalet, un port…).
- **Le temps actuel** du lieu, rafraîchi toutes les 30 minutes : température,
  ressenti, humidité, pression, vent (moyen, rafales, direction), nébulosité,
  précipitations (intensité et type), visibilité, probabilité d'orage et le
  temps en toutes lettres.
- **Les avertissements météo du SMHI** (jaune, orange, rouge) dont la zone
  couvre le lieu : un niveau que les scènes de Gladys peuvent comparer, un
  texte, et un déclencheur de scène.
- Un **widget de tableau de bord** avec les prochaines 24 heures et les jours
  à venir.
- Une **action de scène** qui lit une journée de prévision (aujourd'hui,
  demain, après-demain) pour un message du matin ou une alerte gel.

La prévision couvre la zone du modèle du SMHI : les pays nordiques et la
région balte (Suède, Norvège, Finlande, Danemark, pays baltes et les mers
alentour). Les avertissements n'existent que pour la Suède et ses eaux.

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Gladys doit joindre `opendata-download-metfcst.smhi.se` et
  `opendata-download-warnings.smhi.se` en HTTPS.
- Pour les maisons : une position renseignée dans **Paramètres → Maisons** de
  Gladys.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub** et saisissez
   `https://github.com/guim31/gladys-smhi`, ou installez **SMHI** depuis le
   store.
2. Acceptez l'accès à la position des maisons : il sert à demander au SMHI la
   prévision de chaque maison, rien d'autre.
3. Ouvrez l'onglet **Découverte** de l'intégration et ajoutez les appareils
   des lieux voulus.

## Configuration

| Champ                          | Défaut      | Usage                                                                            |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------- |
| Prévoir pour les maisons       | activé      | Un appareil par maison localisée dans Gladys.                                    |
| Autre lieu : latitude          | vide        | Degrés décimaux (`59.3293`, la virgule marche aussi). Vide : les maisons seules. |
| Autre lieu : longitude         | vide        | Degrés décimaux, positifs vers l'est (`18.0686`).                                |
| Autre lieu : nom               | SMHI        | Nom de l'appareil de ce lieu.                                                    |
| Comté pour les avertissements  | Automatique | Automatique : les avertissements dont la zone dessinée contient le lieu.         |
| Intervalle de rafraîchissement | 30 min      | 15 min, 30 min ou 1 heure. Le SMHI met à jour sa prévision environ chaque heure. |
| Langue                         | Français    | Noms des fonctionnalités des nouveaux appareils, textes de temps, résumés.       |

Choisir un **comté** garde aussi tous les avertissements qui touchent le
comté, même quand leur zone dessinée ne contient pas le lieu : utile en
bordure d'une zone, au prix d'avertissements pour l'autre bout du comté.

Les noms des fonctionnalités sont figés à l'ajout de l'appareil : changez
d'abord la langue, puis ajoutez les appareils.

## L'appareil d'un lieu

| Fonctionnalité         | Unité | Remarques                                                                   |
| ---------------------- | ----- | --------------------------------------------------------------------------- |
| Température            | °C    | Température de l'air à 2 m.                                                 |
| Ressenti               | °C    | Calculé (formule de Steadman : température, humidité, vent).                |
| Humidité               | %     | Humidité relative.                                                          |
| Pression               | hPa   | Au niveau de la mer.                                                        |
| Vitesse du vent        | m/s   | Vent moyen à 10 m.                                                          |
| Rafales                | m/s   |                                                                             |
| Direction du vent      | °     | D'où vient le vent (0 nord, 90 est).                                        |
| Nébulosité             | %     | Part du ciel couverte.                                                      |
| Précipitations         | mm/h  | Intensité moyenne de l'heure.                                               |
| Type de précipitations | texte | Pluie, neige, neige mouillée, bruine… « Pas de précipitations » sinon.      |
| Visibilité             | km    |                                                                             |
| Probabilité d'orage    | %     |                                                                             |
| Temps                  | texte | Le symbole météo du SMHI en toutes lettres (Couvert, Pluie faible…).        |
| Niveau d'avertissement | 0 à 3 | 0 aucun, 1 jaune, 2 orange, 3 rouge : le plus haut avertissement du lieu.   |
| Avertissements         | texte | Les avertissements en cours, le plus grave d'abord, avec la fin du premier. |

Toutes les fonctionnalités sont en lecture seule. Les valeurs sont celles de
la prévision pour l'heure en cours : le SMHI publie une prévision de modèle,
pas les mesures d'une station météo. Gladys convertit température, vitesse et
distance dans les unités de chaque utilisateur.

## Widget de tableau de bord

Ajoutez le widget **Prévisions SMHI** à un tableau de bord et choisissez le
lieu (le premier si aucun n'est choisi). Il montre le temps en toutes lettres
et l'heure de la dernière lecture, la température, le ressenti et le vent,
une courbe des prochaines 24 heures, les avertissements en cours et six jours
(temps, températures minimale et maximale, précipitations). Il suit la
langue et les unités de l'utilisateur.

## Déclencheur de scène : nouvel avertissement météo du SMHI

Se déclenche quand le SMHI émet un avertissement dont la zone couvre un lieu,
ou relève le niveau d'un avertissement en cours (jaune vers orange…). Filtres :
le lieu, les niveaux. Variables pour les actions suivantes : le niveau
(`yellow`, `orange`, `red`), le phénomène, la zone, la description, le début
et la fin. Le SMHI écrit phénomènes et descriptions en suédois et en anglais :
l'intégration transmet l'anglais.

Un avertissement n'est annoncé qu'une fois : ni une nouvelle lecture ni un
redémarrage de l'intégration ne relancent le déclencheur pour le même
avertissement au même niveau.

## Action de scène : lire la prévision du SMHI

Choisissez le lieu et le jour (aujourd'hui, demain, après-demain). L'action
renvoie, pour les actions suivantes de la scène : les températures minimale
et maximale (°C), les précipitations (mm), la plus forte rafale (m/s), la plus
haute probabilité d'orage (%), le temps en toutes lettres, et une phrase de
résumé dans la langue de la configuration.

## Action de configuration : vérifier la prévision

Le bouton **Vérifier la prévision** interroge le SMHI tout de suite pour
chaque lieu, ajouté ou non, et affiche la réponse : température, temps et
niveau d'avertissement, ou la raison d'un échec (lieu hors de la zone de
prévision, SMHI qui ne répond pas).

## Exemples de scènes

- **Message du matin** : à 7 h, _Lire la prévision du SMHI_ (aujourd'hui),
  puis envoyer la sortie _résumé_ à la famille par message.
- **Alerte gel** : à 18 h, _Lire la prévision du SMHI_ (demain) ; si la
  _température minimale_ est sous 0, envoyer « Couvrez les plantes ce soir ».
- **Tempête** : déclencheur _Nouvel avertissement météo du SMHI_ avec les
  niveaux orange et rouge, puis envoyer le phénomène et la description, et
  replier le store.
- **Orage** : quand la _probabilité d'orage_ dépasse 50 %, éteindre les
  appareils sensibles.

## Rafraîchissement et quotas

L'intégration se rafraîchit d'elle-même, à l'intervalle choisi (30 minutes
par défaut), même quand Gladys n'interroge pas l'appareil. Chaque
rafraîchissement fait une requête par lieu ajouté et une pour les
avertissements (toute la Suède d'un coup). Les lieux dont l'appareil n'est pas
ajouté ne sont jamais lus, sauf par le bouton _Vérifier la prévision_. Le SMHI
ne publie pas de quota pour ses données ouvertes et met à jour son modèle
environ une fois par heure : un intervalle plus court n'apporte rien. Les
données sont publiées par le SMHI sous licence Creative Commons Attribution
4.0.

## Dépannage

- **« Aucun lieu »** : aucune maison de Gladys n'est localisée et aucune
  coordonnée n'est saisie. Localisez une maison (Paramètres → Maisons), ou
  saisissez une latitude et une longitude.
- **« Coordonnées illisibles »** : saisissez des degrés décimaux, comme
  `59.3293` et `18.0686`, pas des degrés et minutes.
- **« Hors de la zone de prévision du SMHI »** : le lieu est hors de la zone
  du modèle du SMHI (pays nordiques et baltes). Une autre intégration est
  nécessaire là-bas.
- **« Le SMHI ne répond pas »** : Gladys ne joint pas le SMHI (réseau, DNS,
  panne du SMHI). La dernière prévision est gardée tant qu'elle couvre le
  présent, et un nouvel essai suit au prochain rafraîchissement.
- **Pas d'avertissement alors que le SMHI en affiche un** : la zone dessinée
  de l'avertissement peut ne pas contenir le point exact du lieu. Choisissez
  votre comté dans _Comté pour les avertissements_.
- **Plus de détails** : réglez `LOG_LEVEL=debug` sur l'intégration pour voir
  chaque lecture dans ses journaux.

## Limites

- Une prévision, pas une mesure : les valeurs viennent du modèle du SMHI pour
  le point le plus proche de sa grille (environ 2,5 km).
- Les avertissements ne couvrent que la Suède ; leurs textes sont en anglais.
- Les noms des fonctionnalités et des appareils sont figés à l'ajout de
  l'appareil.
- Ni indice UV, ni pollen, ni risque d'incendie : le SMHI les publie
  ailleurs.
- Changer les coordonnées de l'_autre lieu_ crée un nouvel appareil (un
  nouveau lieu a son propre historique).

## Crédits et licence

Données : © SMHI, Creative Commons Attribution 4.0. La lecture de l'API suit
l'intégration Home Assistant `smhi` et la bibliothèque `pysmhi` de
G Johansson (MIT). Intégration sous licence Apache 2.0. Sans lien avec le
SMHI.
