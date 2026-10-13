import * as fct from "./fonctions.js";
import { BOUTONS_VALIDER } from "./menu.js";

/***********************************************************************/
/** MENU PAUSE : reprendre, commandes, classement, retour au menu
/** lancé par-dessus niveau1 (qui est gelé) quand un joueur appuie sur son bouton Pause (I ou R) ; cf. niveau1.js
/***********************************************************************/

// les boutons, de haut en bas (images chargées dans selection.js)
// action : nom de la méthode appelée à la validation (le classement n'est pas encore fait : pas d'action)
const OPTIONS = [
  { image: "img_pause_reprendre", action: "reprendre" },
  { image: "img_pause_controles", action: "commandes" },
  { image: "img_pause_classement" },
  { image: "img_pause_retour_menu", action: "retourMenu" }
];
const LARGEUR_BOUTON = 460; // px : largeur affichée des boutons
const Y_TITRE = 80; // px
const Y_PREMIER_BOUTON = 200; // px
const ECART_BOUTONS = 105; // px
const ECHELLE_SELECTION = 1.08; // le bouton choisi est un peu plus grand...
const OPACITE_AUTRES = 0.55; // ... et les autres sont assombris
const DELAI_OUVERTURE = 250; // ms : le bouton qui ouvre la pause est encore enfoncé, on ignore les touches un instant

// scene du menu pause : navigation au joystick, validation avec un bouton d'action (comme menu.js)
// le bouton Pause (n'importe quel joueur) reprend la partie directement
export default class pause extends Phaser.Scene {
  constructor() {
    super({ key: "pause" });
  }

  create() {
    this.scene.bringToTop(); // au-dessus du niveau gelé
    this.prete = false;
    this.time.delayedCall(DELAI_OUVERTURE, () => { this.prete = true; });

    // voile sombre : on devine le jeu derrière
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x080d1c, 0.75).setOrigin(0, 0);
    this.add.text(this.scale.width / 2, Y_TITRE, "PAUSE", { fontFamily: fct.POLICES.bouton, fontSize: "40px", color: "#EC8697", stroke: "#20283A", strokeThickness: 6 })
      .setOrigin(0.5);

    this.boutons = OPTIONS.map((option, i) => {
      this.textures.get(option.image).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const bouton = this.add.image(this.scale.width / 2, Y_PREMIER_BOUTON + i * ECART_BOUTONS, option.image);
      bouton.echelle_normale = LARGEUR_BOUTON / bouton.width;
      return bouton;
    });
    this.choix = 0;
    this.majSelection();

    this.add.text(this.scale.width / 2, this.scale.height - 34, "Joystick : choisir      Bouton : valider      Pause : reprendre", { fontFamily: fct.POLICES.texte, fontSize: "22px", color: "#E8EBF0", stroke: "#080D1C", strokeThickness: 5 })
      .setOrigin(0.5);

    // les touches des deux joueurs (cf. fonctions.js)
    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));
  }

  // met en avant le bouton choisi
  majSelection() {
    this.boutons.forEach((bouton, i) => {
      const choisi = i === this.choix;
      bouton.setScale(bouton.echelle_normale * (choisi ? ECHELLE_SELECTION : 1));
      bouton.setAlpha(choisi ? 1 : OPACITE_AUTRES);
    });
  }

  // rend la main au niveau : les sons repartent, le menu pause se ferme
  reprendre() {
    this.sound.resumeAll();
    this.scene.resume("niveau1");
    this.scene.stop();
  }

  // l'écran des commandes (cf. infos.js) par-dessus la pause ; il rend la main à la pause quand on appuie sur un bouton
  commandes() {
    this.scene.launch("infos", { page: "commandes", depuis_pause: true });
    this.scene.bringToTop("infos");
    this.scene.pause();
  }

  // abandonne la partie : le niveau est arrêté, retour au menu principal
  retourMenu() {
    this.scene.get("niveau1").quitterPartie();
    this.scene.stop("niveau1");
    this.scene.start("menu");
  }

  update() {
    if (!this.prete) return;

    const appuye = (touche) => Phaser.Input.Keyboard.JustDown(touche);
    if (this.touches.some((t) => appuye(t.pause))) {
      this.reprendre();
      return;
    }
    if (this.touches.some((t) => appuye(t.haut))) this.choix = (this.choix + OPTIONS.length - 1) % OPTIONS.length;
    if (this.touches.some((t) => appuye(t.bas))) this.choix = (this.choix + 1) % OPTIONS.length;
    this.majSelection();

    const action = OPTIONS[this.choix].action;
    if (action && this.touches.some((t) => BOUTONS_VALIDER.some((bouton) => appuye(t[bouton])))) this[action]();
  }
}
