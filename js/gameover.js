import * as fct from "./fonctions.js";
import { BOUTONS_VALIDER } from "./menu.js";

/***********************************************************************/
/** GAME OVER : quand tous les joueurs sont à 0 PV (cf. niveau1.js)
/** affiche le niveau atteint et les pierres lunaires, puis un bouton ramène au menu
/***********************************************************************/

const DUREE_FONDU = 600; // ms
const LARGEUR_TITRE = 640; // px : largeur affichée de l'image "GAME OVER" (1300 px d'origine)
const DELAI_BOUTON = 1200; // ms : on ignore les boutons un instant pour ne pas quitter l'écran par erreur (on était en train de se battre)

export default class gameover extends Phaser.Scene {
  constructor() {
    super({ key: "gameover" });
  }

  create(data) {
    this.cameras.main.setBackgroundColor("#080D1C");
    this.cameras.main.fadeIn(DUREE_FONDU);
    this.quitte = false;
    this.pret = false;

    this.add.image(0, 0, "img_fond_game_over").setOrigin(0, 0);

    this.textures.get("img_titre_game_over").setFilter(Phaser.Textures.FilterMode.LINEAR);
    const titre = this.add.image(this.scale.width / 2, 210, "img_titre_game_over");
    titre.setScale(LARGEUR_TITRE / titre.width);
    // le titre apparait en grossissant un peu
    this.tweens.add({ targets: titre, scale: { from: titre.scale * 0.8, to: titre.scale }, alpha: { from: 0, to: 1 }, duration: 700, ease: "Back.easeOut" });

    const style = { fontFamily: fct.POLICES.texte, fontSize: "30px", color: "#E8EBF0", stroke: "#080D1C", strokeThickness: 6 };
    this.add.text(this.scale.width / 2, 400, "Niveau atteint : " + data.niveau, style).setOrigin(0.5);
    this.add.image(this.scale.width / 2 - 70, 462, "img_pierre_lunaire").setScale(2);
    this.add.text(this.scale.width / 2 - 40, 462, "x" + data.pierres, { fontFamily: fct.POLICES.bouton, fontSize: "26px", color: "#E8EBF0", stroke: "#080D1C", strokeThickness: 6 })
      .setOrigin(0, 0.5);

    const invite = this.add.text(this.scale.width / 2, 600, "Appuie sur un bouton pour revenir au menu", { fontFamily: fct.POLICES.texte, fontSize: "24px", color: "#BFC3CC", stroke: "#080D1C", strokeThickness: 5 })
      .setOrigin(0.5)
      .setAlpha(0);
    this.time.delayedCall(DELAI_BOUTON, () => {
      this.pret = true;
      this.tweens.add({ targets: invite, alpha: { from: 0.35, to: 1 }, duration: 800, yoyo: true, repeat: -1 });
    });

    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));
  }

  update() {
    if (!this.pret || this.quitte) return;
    const appuye = (touche) => Phaser.Input.Keyboard.JustDown(touche);
    if (!this.touches.some((t) => BOUTONS_VALIDER.some((bouton) => appuye(t[bouton])))) return;
    this.quitte = true;
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.sound.stopAll(); // la musique de game over s'arrête ; celle du menu repart avec lui
      this.scene.start("menu");
    });
  }
}
