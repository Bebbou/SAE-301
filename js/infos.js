import * as fct from "./fonctions.js";
import { BOUTONS_VALIDER } from "./menu.js";

/***********************************************************************/
/** ECRANS D'INFORMATIONS DU MENU : commandes et crédits
/** n'importe quel bouton d'un joueur ramène au menu
/***********************************************************************/

const DUREE_FONDU = 300; // ms

// actions de la borne, dans l'ordre des deux rangées de boutons (cf. TOUCHES_J1 / TOUCHES_J2 dans fonctions.js)
const ACTIONS = [
  ["interagir", "Interagir en face (échelle)"],
  ["objet", "Interagir avec un objet (statue)"],
  ["torche", "Allumer / éteindre la lampe"],
  ["frapper_tirer", "Frapper / tirer"],
  ["sprint", "Sprint"],
  ["changer_equipement", "Changer d'équipement"]
];
const JOYSTICKS = ["Flèches", "Z Q S D"]; // joystick du joueur 1, du joueur 2

// l'équipe et les ressources : à compléter / corriger ici
const EQUIPE = [
  ["Lino Volle", "programmation"],
  ["Inas Ouarich", "graphismes et cartes"],
  ["Liku Soane Liku o Hihifo Iloai", "chef de projet, sons"]
];
const RESSOURCES = [
  "Graphismes : CraftPix.net (Pixel Dungeon, Ruined Temple)",
  "Polices : Origin Tech, Ethnocentric, Kallisto",
  "Moteur : Phaser 3"
];

export default class infos extends Phaser.Scene {
  constructor() {
    super({ key: "infos" });
  }

  create(data) {
    this.page = data.page; // "commandes" ou "credits"
    this.choix = data.choix; // bouton du menu à retrouver au retour
    this.retour = false;
    this.cameras.main.setBackgroundColor("#080D1C");
    this.cameras.main.fadeIn(DUREE_FONDU);
    this.add.image(0, 0, "img_fond_menu").setOrigin(0, 0);
    // voile sombre sous le texte, pour qu'il reste lisible sur le décor
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x080d1c, 0.72).setOrigin(0, 0);

    if (this.page === "commandes") this.dessinerCommandes();
    else this.dessinerCredits();

    this.add.text(this.scale.width / 2, this.scale.height - 34, "Appuie sur un bouton pour revenir", { fontFamily: fct.POLICES.texte, fontSize: "22px", color: "#BFC3CC" })
      .setOrigin(0.5);

    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));
  }

  titre(texte) {
    this.add.text(this.scale.width / 2, 70, texte, { fontFamily: fct.POLICES.bouton, fontSize: "40px", color: "#EC8697", stroke: "#20283A", strokeThickness: 6 })
      .setOrigin(0.5);
  }

  // deux colonnes, une par joueur : joystick puis les 6 boutons
  dessinerCommandes() {
    this.titre("COMMANDES");
    fct.JOUEURS.forEach((joueur, i) => {
      const x = this.scale.width * (i === 0 ? 0.27 : 0.73);
      this.add.text(x, 150, "JOUEUR " + joueur.numero, { fontFamily: fct.POLICES.bouton, fontSize: "24px", color: "#E8EBF0" }).setOrigin(0.5);
      this.add.text(x, 192, "Joystick : " + JOYSTICKS[i], { fontFamily: fct.POLICES.texte, fontSize: "22px", color: "#BFC3CC" }).setOrigin(0.5);
      ACTIONS.forEach(([action, libelle], rang) => {
        const y = 250 + rang * 62;
        this.add.text(x - 235, y, "[" + joueur.touches[action] + "]", { fontFamily: fct.POLICES.bouton, fontSize: "20px", color: "#EC8697" }).setOrigin(0, 0.5);
        this.add.text(x - 170, y, libelle, { fontFamily: fct.POLICES.texte, fontSize: "20px", color: "#E8EBF0" }).setOrigin(0, 0.5);
      });
    });
  }

  dessinerCredits() {
    this.titre("CREDITS");
    const centre = this.scale.width / 2;
    let y = 170;
    this.add.text(centre, y, "ARTEMIS · SAÉ 301", { fontFamily: fct.POLICES.bouton, fontSize: "22px", color: "#E8EBF0" }).setOrigin(0.5);
    y += 70;
    EQUIPE.forEach(([nom, role]) => {
      this.add.text(centre, y, nom, { fontFamily: fct.POLICES.texte, fontSize: "30px", color: "#E8EBF0" }).setOrigin(0.5);
      this.add.text(centre, y + 32, role, { fontFamily: fct.POLICES.texte, fontSize: "20px", color: "#EC8697" }).setOrigin(0.5);
      y += 86;
    });
    y += 10;
    RESSOURCES.forEach((ligne) => {
      this.add.text(centre, y, ligne, { fontFamily: fct.POLICES.texte, fontSize: "20px", color: "#BFC3CC" }).setOrigin(0.5);
      y += 30;
    });
  }

  update() {
    if (this.retour) return;
    const appuye = (touche) => Phaser.Input.Keyboard.JustDown(touche);
    if (!this.touches.some((t) => BOUTONS_VALIDER.some((bouton) => appuye(t[bouton])))) return;
    this.retour = true;
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("menu", { choix: this.choix }));
  }
}
