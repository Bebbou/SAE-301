import * as fct from "./fonctions.js";

/***********************************************************************/
/** MENU : jouer seul, jouer à deux, commandes, crédits
/***********************************************************************/

// les boutons, de haut en bas (images chargées dans selection.js)
// nb_joueurs : lance la partie ; page : ouvre l'écran d'informations correspondant (cf. infos.js)
const OPTIONS = [
  { image: "img_bouton_solo", nb_joueurs: 1 },
  { image: "img_bouton_duo", nb_joueurs: 2 },
  { image: "img_bouton_controles", page: "commandes" },
  { image: "img_bouton_credits", page: "credits" }
];
const LARGEUR_BOUTON = 460; // px : largeur affichée des boutons (les images font 920 px : net sur un grand écran)
const LARGEUR_LOGO = 450; // px
const Y_LOGO = 125; // px
const Y_PREMIER_BOUTON = 300; // px
const ECART_BOUTONS = 100; // px
const ECHELLE_SELECTION = 1.08; // le bouton choisi est un peu plus grand...
const OPACITE_AUTRES = 0.55; // ... et les autres sont assombris
const DUREE_FONDU = 300; // ms
// boutons d'action des joueurs qui valident le choix (la navigation se fait au joystick, haut / bas)
export const BOUTONS_VALIDER = ["frapper_tirer", "sprint", "torche", "changer_equipement"];

/* >>>>> AJOUT SON <<<<< */ // musique de l'écran d'accueil
/* >>>>> AJOUT SON <<<<< */ var son_accueil;

// scene du menu : elle choisit le nombre de joueurs (registry "nb_joueurs"), remet le jeu à zéro puis lance le niveau 1
// n'importe quel joueur peut naviguer et valider, avec son joystick et ses boutons
export default class menu extends Phaser.Scene {
  constructor() {
    super({ key: "menu" });
  }

  create(data) {
    this.cameras.main.setBackgroundColor("#080D1C"); // bleu nuit de la palette
    this.cameras.main.fadeIn(DUREE_FONDU);
    this.lancement = false; // true dès qu'un choix est validé : on ignore alors les touches

    this.add.image(0, 0, "img_fond_menu").setOrigin(0, 0);

    // le logo et les boutons sont réduits : on adoucit le filtre (le mode pixel art les rendrait crénelés)
    this.textures.get("img_logo").setFilter(Phaser.Textures.FilterMode.LINEAR);
    const logo = this.add.image(this.scale.width / 2, Y_LOGO, "img_logo");
    logo.setScale(LARGEUR_LOGO / logo.width);

    this.boutons = OPTIONS.map((option, i) => {
      this.textures.get(option.image).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const bouton = this.add.image(this.scale.width / 2, Y_PREMIER_BOUTON + i * ECART_BOUTONS, option.image);
      bouton.echelle_normale = LARGEUR_BOUTON / bouton.width;
      return bouton;
    });
    // on revient d'un écran d'informations sur le bouton qui l'a ouvert ; sinon : jouer seul par défaut
    this.choix = data?.choix ?? 0;
    this.majSelection();

    this.add.text(this.scale.width / 2, this.scale.height - 34, "Joystick : choisir      Bouton : valider", { fontFamily: fct.POLICES.texte, fontSize: "22px", color: "#E8EBF0", stroke: "#080D1C", strokeThickness: 5 })
      .setOrigin(0.5);

    // les touches des deux joueurs (cf. fonctions.js)
    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));

    /* >>>>> AJOUT SON <<<<< */ // musique de l'écran d'accueil (une seule instance, qui continue quand on passe par les commandes ou les crédits)
    /* >>>>> AJOUT SON <<<<< */ son_accueil = this.sound.get("accueil") ?? this.sound.add("accueil");
    /* >>>>> AJOUT SON <<<<< */ if (!son_accueil.isPlaying) son_accueil.play({ loop: true });
  }

  // met en avant le bouton choisi
  majSelection() {
    this.boutons.forEach((bouton, i) => {
      const choisi = i === this.choix;
      bouton.setScale(bouton.echelle_normale * (choisi ? ECHELLE_SELECTION : 1));
      bouton.setAlpha(choisi ? 1 : OPACITE_AUTRES);
    });
  }

  // valide le bouton choisi : une partie, ou un écran d'informations
  valider() {
    const option = OPTIONS[this.choix];
    this.lancement = true;
    this.cameras.main.fadeOut(DUREE_FONDU);

    if (option.page) {
      this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("infos", { page: option.page, choix: this.choix }));
      return;
    }

    /* >>>>> AJOUT SON <<<<< */ son_accueil.stop();
    // nouvelle partie : on oublie les niveaux visités (le jeu garde en mémoire l'état de chaque niveau pour pouvoir y revenir)
    this.registry.set("niveaux", {});
    this.registry.set("pierres_lunaires", 0);
    this.registry.set("nb_joueurs", option.nb_joueurs);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("niveau1", { niveau: 1 }));
  }

  update() {
    if (this.lancement) return;

    const appuye = (touche) => Phaser.Input.Keyboard.JustDown(touche);
    if (this.touches.some((t) => appuye(t.haut))) this.choix = (this.choix + OPTIONS.length - 1) % OPTIONS.length;
    if (this.touches.some((t) => appuye(t.bas))) this.choix = (this.choix + 1) % OPTIONS.length;
    this.majSelection();

    if (this.touches.some((t) => BOUTONS_VALIDER.some((bouton) => appuye(t[bouton])))) this.valider();
  }
}
