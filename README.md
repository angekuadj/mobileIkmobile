# IKProno Mobile

Application Android/iOS construite avec Expo, React Native et Expo Router. Elle charge les rencontres directement depuis FotMob en HTTPS, sans serveur IKProno, base distante ni URL d’hôte à configurer.

## Fonctionnalités mobiles

- Accueil avec rencontres en direct et matchs à venir.
- Calendrier football filtrable par jour, semaine, mois, statut, tranche horaire et recherche.
- Logos des clubs dans les cartes de rencontre et portraits des joueurs dans les détails, chargés depuis FotMob avec un visuel de remplacement.
- Détails d'une rencontre : scores, chronologie des événements par mi-temps avec recherche par joueur/équipe/événement, compositions, statistiques, confrontations et classement selon les données FotMob disponibles.
- Cartons rouges affichés avec le nombre et le nom de l’équipe concernée dans les détails et les cartes qui disposent de ces statistiques.
- Cartes des matchs en direct avec affichage de la minute jouée lorsque FotMob la fournit.
- Favoris de rencontres accessibles par le cœur des cartes et la fiche du match, avec scores actualisés.
- Suivi en direct d'une rencontre en un geste grâce à la cloche des cartes et de la fiche du match : coup d'envoi, buts, cartons jaunes, cartons rouges et fin de match.
- Alertes locales personnalisables par match : coup d'envoi, buts, cartons jaunes, cartons rouges et fin de match ; suivi en premier plan et vérifications en arrière-plan quand le système les autorise.
- Écran « Test des notifications » : aperçu du rendu des alertes de but et de carton, puis envoi réel de notifications de test depuis l'appareil.
- Notifications locales habillées avec un son IKProno dédié, la minute de jeu dans le titre des alertes live, le score courant pour les alertes de but et de carton, les équipes en premier plan, une icône ballon monochrome et une couleur d’accent adaptée à l’événement.
- Panier persistant de vingt rencontres maximum, actualisation des statuts/scores et sélections enregistrées.
- Consultation des rencontres et de leurs détails sans profil ; deux combinaisons gratuites au total pour un utilisateur sans profil local.
- Suggestions de trois combinaisons par génération avec choix du niveau de risque pour un profil local.
- Écrans mobiles de recherche, suivi en direct et analyse des rencontres.
- Parcours de découverte, tableau de bord, profil local modifiable, aide/FAQ/contact et pages d’information.
- Récupération de compte par e-mail via Firebase et formulaire d’évaluation mobile ; comme sur le web, les évaluations sont une démonstration locale et ne sont pas transmises à un serveur.
- Présentation des offres et tirages en mode simulation clairement signalé, sans transaction ni prix réels.
- Administration fermée par défaut : aucune autorisation administrateur sécurisée n’est fournie par un serveur.
- Thème sombre par défaut et thème clair aux couleurs violettes/fuchsia, sélectionnables dans le profil et mémorisés sur l’appareil.
- Interface disponible en français et en anglais ; le français est la langue par défaut et la préférence peut être modifiée depuis le bouton FR/EN de l’accueil ou dans le profil.

Le flux de rencontres FotMob ne fournit que le football. Les données sont conservées localement dans Realm. Lorsqu’un utilisateur est connecté à Firebase, les favoris, sélections, paniers et certaines préférences sont également synchronisés avec Firestore entre installations mobiles ; ils restent distincts des données du site web. Les données précédemment stockées avec AsyncStorage sont migrées lors de la première ouverture.

Les alertes utilisent les notifications locales et ne nécessitent ni compte ni secrets de serveur. Les événements sont interrogés depuis FotMob ; en arrière-plan, le système d'exploitation décide de la fréquence et peut retarder les notifications. L'actualisation en premier plan se fait toutes les 30 secondes. Cette version ne fournit pas de service push distant garantissant une alerte instantanée lorsque l'application est arrêtée.

## Limites de compte et de démonstration

La connexion et l’inscription utilisent Firebase Auth par e-mail et mot de passe lorsque Firebase est configuré ; un profil local de secours peut être utilisé hors de cette configuration. Les favoris, sélections et préférences mobiles ne sont pas synchronisés avec le site web. Les offres Premium et le tirage sont des simulations locales ; aucun paiement, pari, gain, loterie réelle ou renouvellement n’est déclenché. Les suggestions de combinaisons sont indicatives, non garanties et fondées sur les seules données historiques disponibles.

Le quota anonyme est conservé sur l’appareil et n’est pas associé à un compte serveur ; il peut donc être réinitialisé en effaçant les données de l’application ou en la réinstallant.

## Démarrer

```bash
npm install
npm start
```

Pour lancer directement une plateforme :

```bash
npm run android
npm run ios
npm run web
```

## Données et stockage

Les écrans mobiles interrogent directement les API HTTPS publiques de FotMob pour le calendrier, les scores et les détails des rencontres. Les calendriers sont actualisés toutes les 5 minutes, les scores/minutes en direct toutes les 30 secondes et les statistiques détaillées toutes les 2 minutes en premier plan ; le retour dans l’application relance l’actualisation, sans faire disparaître les cartes déjà affichées. Le calendrier utilise une liste virtualisée pour rester fluide sur les périodes chargées. Aucun service IKProno ou identifiant de base de données n’est nécessaire pour afficher les matchs. Une connexion Internet est requise.

Realm est la base NoSQL embarquée utilisée pour les données locales utilisateur. Elle fonctionne hors ligne et ne synchronise pas les informations avec le site web. AsyncStorage reste utilisé uniquement pour importer les données locales des versions précédentes.

La langue de l’application peut être sélectionnée avec le bouton FR/EN de l’accueil ou depuis le profil. Le français est utilisé par défaut ; le choix français/anglais est mémorisé localement dans Realm sur l’appareil et s’applique aux écrans, aux libellés d’accessibilité, aux formulaires et aux alertes locales. Les noms d’équipes, de ligues et les données sportives fournies par FotMob ne sont pas traduits.

Le dossier `server/` conserve un serveur Node.js autonome pour les intégrations qui en ont besoin ; l’application mobile ne l’appelle pas.

## Vérification TypeScript

```bash
npx tsc --noEmit
```

## Builds

Les scripts `build:android` et `build:ios` utilisent EAS Build. Configurez votre compte EAS avant leur exécution.
