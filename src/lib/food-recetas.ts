// Platos típicos de la cocina española calculados a partir de su receta casera: cada plato
// suma las kcal y macros de sus ingredientes CRUDOS (valores de la biblioteca de alimentos) y
// los reparte entre el peso del plato terminado. No es una medición: depende de la receta, de
// lo que absorba la fritura y de lo que se evapore; úsalo como estimación razonable.
//
// ingredientes: [nombre exacto del alimento, gramos tal como se pesan en crudo]. El aceite de
//   las frituras se cuenta solo en lo que absorbe el plato.
// pesoFinal: gramos del plato ya cocinado (tras evaporación o absorción de agua y aceite).
// raciones: para cuántas personas es la receta · racion: gramos de una ración si no es pesoFinal/raciones
// unidad: [gramos, nombre] cuando el plato se cuenta por piezas (croqueta, torrija, porción)
// tamanos: la pieza es la «mediana» y en el diario se puede elegir pequeña o grande (ver TAMANOS)
import type { SeedFood } from "./food-seed";

export type Receta = {
  nombre: string;
  raciones: number;
  ingredientes: [string, number][];
  pesoFinal: number;
  racion?: number;
  unidad?: [number, string];
  tamanos?: true;
};

export const RECETAS: Receta[] = [
  { nombre: "Salmorejo cordobés (receta casera)", raciones: 4, ingredientes: [["Tomate", 1000], ["Pan blanco", 200], ["Aceite de oliva virgen extra (AOVE)", 100], ["Ajo (crudo)", 5]], pesoFinal: 1300 },
  { nombre: "Salmorejo con huevo duro y jamón (receta casera)", raciones: 4, ingredientes: [["Tomate", 1000], ["Pan blanco", 200], ["Aceite de oliva virgen extra (AOVE)", 100], ["Ajo (crudo)", 5], ["Huevo entero", 100], ["Jamón serrano", 50]], pesoFinal: 1450 },
  { nombre: "Gazpacho andaluz (receta casera)", raciones: 4, ingredientes: [["Tomate", 1000], ["Pepino", 150], ["Pimiento verde", 100], ["Cebolla", 30], ["Ajo (crudo)", 5], ["Aceite de oliva virgen extra (AOVE)", 60], ["Pan blanco", 40]], pesoFinal: 1500, racion: 300 },
  { nombre: "Ajoblanco (receta casera)", raciones: 4, ingredientes: [["Almendras", 150], ["Pan blanco", 80], ["Ajo (crudo)", 10], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 1000, racion: 250 },
  { nombre: "Crema de calabacín (receta casera)", raciones: 4, ingredientes: [["Calabacín", 600], ["Patata (cruda)", 150], ["Cebolla", 100], ["Queso en porciones (tipo quesitos)", 34], ["Aceite de oliva virgen extra (AOVE)", 20]], pesoFinal: 1100 },
  { nombre: "Sopa de ajo castellana (receta casera)", raciones: 4, ingredientes: [["Pan blanco", 200], ["Ajo (crudo)", 40], ["Aceite de oliva virgen extra (AOVE)", 40], ["Huevo entero", 200], ["Jamón serrano", 50]], pesoFinal: 1400, racion: 350 },
  { nombre: "Lentejas estofadas con chorizo (receta casera)", raciones: 4, ingredientes: [["Lentejas (secas)", 300], ["Chorizo", 80], ["Zanahoria", 100], ["Cebolla", 100], ["Pimiento verde", 80], ["Tomate", 100], ["Patata (cruda)", 150], ["Aceite de oliva virgen extra (AOVE)", 30], ["Ajo (crudo)", 5]], pesoFinal: 1800, racion: 400 },
  { nombre: "Lentejas con verduras (receta casera, sin carne)", raciones: 4, ingredientes: [["Lentejas (secas)", 300], ["Zanahoria", 100], ["Cebolla", 100], ["Pimiento verde", 80], ["Tomate", 100], ["Patata (cruda)", 150], ["Aceite de oliva virgen extra (AOVE)", 30], ["Ajo (crudo)", 5]], pesoFinal: 1750, racion: 400 },
  { nombre: "Garbanzos con espinacas (receta casera)", raciones: 4, ingredientes: [["Garbanzos (secos)", 300], ["Espinacas", 400], ["Aceite de oliva virgen extra (AOVE)", 40], ["Ajo (crudo)", 10], ["Pan blanco", 30]], pesoFinal: 1500, racion: 375 },
  { nombre: "Cocido madrileño, plato completo (receta casera)", raciones: 4, ingredientes: [["Garbanzos (secos)", 300], ["Ternera magra, redondo (cruda)", 300], ["Contramuslo de pollo con piel (crudo)", 400], ["Chorizo", 100], ["Morcilla", 100], ["Panceta de cerdo fresca (cruda)", 80], ["Patata (cruda)", 400], ["Zanahoria", 200], ["Repollo", 300]], pesoFinal: 2300, racion: 575 },
  { nombre: "Fabada asturiana (receta casera)", raciones: 4, ingredientes: [["Alubias blancas (secas)", 400], ["Chorizo", 120], ["Morcilla", 120], ["Panceta de cerdo fresca (cruda)", 100]], pesoFinal: 1850, racion: 460 },
  { nombre: "Callos a la madrileña (receta casera)", raciones: 4, ingredientes: [["Callos de ternera", 700], ["Chorizo", 80], ["Morcilla", 60], ["Tomate triturado (lata)", 100], ["Cebolla", 100], ["Aceite de oliva virgen extra (AOVE)", 20]], pesoFinal: 1000, racion: 250 },
  { nombre: "Marmitako de atún (receta casera)", raciones: 4, ingredientes: [["Atún fresco (crudo)", 500], ["Patata (cruda)", 600], ["Pimiento verde", 150], ["Cebolla", 150], ["Tomate", 100], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 1700, racion: 425 },
  { nombre: "Croquetas de jamón (receta casera)", raciones: 6, ingredientes: [["Leche entera", 500], ["Harina de trigo", 60], ["Mantequilla", 50], ["Jamón serrano", 100], ["Cebolla", 30], ["Huevo entero", 50], ["Pan rallado", 80], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 850, racion: 140, unidad: [35, "croqueta"] },
  { nombre: "Croquetas de pollo (receta casera)", raciones: 6, ingredientes: [["Leche entera", 500], ["Harina de trigo", 60], ["Mantequilla", 50], ["Pechuga de pollo (cruda)", 150], ["Cebolla", 40], ["Huevo entero", 50], ["Pan rallado", 80], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 850, racion: 140, unidad: [35, "croqueta"] },
  { nombre: "Tortilla de patatas con cebolla (receta casera)", raciones: 6, ingredientes: [["Patata (cruda)", 800], ["Cebolla", 150], ["Huevo entero", 300], ["Aceite de oliva virgen extra (AOVE)", 100]], pesoFinal: 1100, racion: 180 },
  { nombre: "Huevos rotos con jamón (receta casera)", raciones: 2, ingredientes: [["Patata (cruda)", 500], ["Huevo entero", 200], ["Jamón serrano", 80], ["Aceite de oliva virgen extra (AOVE)", 90]], pesoFinal: 770 },
  { nombre: "Patatas bravas (receta casera)", raciones: 2, ingredientes: [["Patata (cruda)", 600], ["Aceite de oliva virgen extra (AOVE)", 70], ["Tomate frito (conserva)", 100], ["Alioli", 40]], pesoFinal: 700 },
  { nombre: "Patatas a lo pobre (receta casera)", raciones: 2, ingredientes: [["Patata (cruda)", 600], ["Cebolla", 100], ["Pimiento verde", 100], ["Aceite de oliva virgen extra (AOVE)", 55]], pesoFinal: 680 },
  { nombre: "Ensaladilla rusa (receta casera)", raciones: 4, ingredientes: [["Patata (cruda)", 400], ["Zanahoria", 100], ["Guisantes (congelados)", 100], ["Atún en aceite de oliva (lata, escurrido)", 150], ["Huevo entero", 150], ["Mayonesa", 150], ["Aceitunas verdes", 40]], pesoFinal: 1080 },
  { nombre: "Pisto manchego (receta casera)", raciones: 4, ingredientes: [["Calabacín", 400], ["Berenjena", 200], ["Pimiento rojo", 200], ["Pimiento verde", 200], ["Cebolla", 200], ["Tomate triturado (lata)", 400], ["Aceite de oliva virgen extra (AOVE)", 80]], pesoFinal: 1250 },
  { nombre: "Pimientos de Padrón fritos (receta casera)", raciones: 2, ingredientes: [["Pimiento verde", 200], ["Aceite de oliva virgen extra (AOVE)", 20]], pesoFinal: 190 },
  { nombre: "Escalivada (receta casera)", raciones: 3, ingredientes: [["Berenjena", 400], ["Pimiento rojo", 300], ["Cebolla", 200], ["Tomate", 200], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 735 },
  // Berenjenas rellenas: 4 berenjenas medianas (250 g crudas cada una) para 4 raciones, con las cantidades
  // intermedias de varias recetas (400 g de carne o 320 g de atún en el relleno). Se cuentan por berenjena
  // entera rellena (dos mitades) y se puede elegir pequeña / mediana / grande al apuntarlas en el diario.
  { nombre: "Berenjenas rellenas de carne y bechamel, gratinadas (receta casera)", raciones: 4, ingredientes: [["Berenjena", 1000], ["Carne picada mixta de vacuno y cerdo (cruda)", 400], ["Cebolla", 100], ["Tomate triturado (lata)", 200], ["Aceite de oliva virgen extra (AOVE)", 30], ["Leche entera", 350], ["Harina de trigo", 35], ["Mantequilla", 35], ["Queso rallado (genérico)", 50]], pesoFinal: 1500, unidad: [375, "berenjena"], tamanos: true },
  { nombre: "Berenjenas rellenas de atún y tomate, gratinadas (receta casera)", raciones: 4, ingredientes: [["Berenjena", 1000], ["Atún en aceite de oliva (lata, escurrido)", 320], ["Tomate frito (conserva)", 200], ["Cebolla", 120], ["Aceite de oliva virgen extra (AOVE)", 30], ["Queso rallado (genérico)", 60]], pesoFinal: 1360, unidad: [340, "berenjena"], tamanos: true },
  { nombre: "Berenjenas rellenas de verduras, gratinadas (receta casera)", raciones: 4, ingredientes: [["Berenjena", 1000], ["Calabacín", 200], ["Pimiento rojo", 150], ["Cebolla", 120], ["Champiñones", 150], ["Tomate triturado (lata)", 200], ["Aceite de oliva virgen extra (AOVE)", 40], ["Queso rallado (genérico)", 60]], pesoFinal: 1280, unidad: [320, "berenjena"], tamanos: true },
  { nombre: "Judías verdes con jamón y patata (receta casera)", raciones: 2, ingredientes: [["Judías verdes", 500], ["Patata (cruda)", 200], ["Jamón serrano", 50], ["Ajo (crudo)", 10], ["Aceite de oliva virgen extra (AOVE)", 25]], pesoFinal: 700 },
  { nombre: "Espinacas con pasas y piñones (receta casera)", raciones: 3, ingredientes: [["Espinacas", 600], ["Pasas", 40], ["Piñones", 30], ["Aceite de oliva virgen extra (AOVE)", 30], ["Ajo (crudo)", 5]], pesoFinal: 420 },
  { nombre: "Menestra de verduras con jamón (receta casera)", raciones: 3, ingredientes: [["Alcachofa (cruda, parte comestible)", 300], ["Guisantes (congelados)", 150], ["Judías verdes", 150], ["Zanahoria", 100], ["Jamón serrano", 50], ["Aceite de oliva virgen extra (AOVE)", 30]], pesoFinal: 650 },
  { nombre: "Champiñones al ajillo con jamón (receta casera)", raciones: 2, ingredientes: [["Champiñones", 400], ["Jamón serrano", 40], ["Ajo (crudo)", 10], ["Aceite de oliva virgen extra (AOVE)", 30]], pesoFinal: 300 },
  { nombre: "Ensalada mixta con atún y huevo (receta casera)", raciones: 2, ingredientes: [["Lechuga romana", 150], ["Tomate", 200], ["Cebolla", 40], ["Atún en aceite de oliva (lata, escurrido)", 80], ["Huevo entero", 50], ["Aceitunas verdes", 30], ["Aceite de oliva virgen extra (AOVE)", 20]], pesoFinal: 570 },
  { nombre: "Paella valenciana (receta casera)", raciones: 4, ingredientes: [["Arroz redondo / bomba (crudo)", 400], ["Contramuslo de pollo con piel (crudo)", 400], ["Conejo (crudo)", 250], ["Judías verdes", 150], ["Alubias blancas (cocidas, escurridas)", 100], ["Tomate", 100], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 1800, racion: 450 },
  { nombre: "Paella de marisco (receta casera)", raciones: 4, ingredientes: [["Arroz redondo / bomba (crudo)", 400], ["Gambas (crudas)", 200], ["Mejillones (crudos, sin concha)", 150], ["Calamar / chipirón (crudo)", 200], ["Pimiento rojo", 100], ["Tomate", 100], ["Ajo (crudo)", 10], ["Aceite de oliva virgen extra (AOVE)", 60]], pesoFinal: 1900, racion: 475 },
  { nombre: "Arroz con pollo (receta casera)", raciones: 4, ingredientes: [["Arroz blanco (crudo)", 320], ["Contramuslo de pollo con piel (crudo)", 600], ["Pimiento rojo", 100], ["Guisantes (congelados)", 100], ["Cebolla", 100], ["Tomate", 100], ["Aceite de oliva virgen extra (AOVE)", 50]], pesoFinal: 1800, racion: 450 },
  { nombre: "Arroz a la cubana (receta casera)", raciones: 1, ingredientes: [["Arroz blanco (crudo)", 80], ["Huevo entero", 55], ["Plátano", 80], ["Tomate frito (conserva)", 60], ["Aceite de oliva virgen extra (AOVE)", 12]], pesoFinal: 410 },
  { nombre: "Macarrones con tomate y carne (receta casera)", raciones: 1, ingredientes: [["Pasta (cruda)", 100], ["Carne picada mixta de vacuno y cerdo (cruda)", 80], ["Tomate frito (conserva)", 120], ["Cebolla", 30], ["Aceite de oliva virgen extra (AOVE)", 5]], pesoFinal: 455 },
  { nombre: "Pollo al ajillo (receta casera)", raciones: 3, ingredientes: [["Contramuslo de pollo con piel (crudo)", 800], ["Ajo (crudo)", 30], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 640 },
  { nombre: "Pollo asado con patatas (receta casera)", raciones: 3, ingredientes: [["Contramuslo de pollo con piel (crudo)", 800], ["Patata (cruda)", 600], ["Cebolla", 100], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 1230 },
  { nombre: "Filete de pechuga empanado (receta casera)", raciones: 1, ingredientes: [["Pechuga de pollo (cruda)", 200], ["Huevo entero", 40], ["Pan rallado", 35], ["Harina de trigo", 15], ["Aceite de oliva virgen extra (AOVE)", 20]], pesoFinal: 250 },
  { nombre: "Albóndigas en salsa de tomate (receta casera)", raciones: 4, ingredientes: [["Carne picada mixta de vacuno y cerdo (cruda)", 500], ["Huevo entero", 50], ["Pan rallado", 50], ["Harina de trigo", 30], ["Cebolla", 150], ["Zanahoria", 100], ["Tomate triturado (lata)", 400], ["Aceite de oliva virgen extra (AOVE)", 70]], pesoFinal: 1150 },
  { nombre: "Rabo de toro estofado (receta casera)", raciones: 4, ingredientes: [["Rabo de toro", 700], ["Cebolla", 150], ["Zanahoria", 150], ["Tomate triturado (lata)", 200], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 1000, racion: 250 },
  { nombre: "Ternera guisada con patatas y guisantes (receta casera)", raciones: 4, ingredientes: [["Aguja de ternera (cruda)", 600], ["Patata (cruda)", 300], ["Zanahoria", 150], ["Guisantes (congelados)", 100], ["Cebolla", 100], ["Tomate triturado (lata)", 150], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 1100 },
  { nombre: "Migas con chorizo y panceta (receta casera)", raciones: 3, ingredientes: [["Pan blanco", 400], ["Chorizo", 100], ["Panceta de cerdo fresca (cruda)", 100], ["Ajo (crudo)", 20], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 650 },
  { nombre: "Calamares a la romana (receta casera)", raciones: 3, ingredientes: [["Calamar / chipirón (crudo)", 400], ["Harina de trigo", 80], ["Huevo entero", 50], ["Aceite de oliva virgen extra (AOVE)", 50]], pesoFinal: 560 },
  { nombre: "Boquerones fritos (receta casera)", raciones: 2, ingredientes: [["Boquerón / anchoa fresca (crudo)", 500], ["Harina de trigo", 40], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 460 },
  { nombre: "Gambas al ajillo (receta casera)", raciones: 2, ingredientes: [["Gambas (crudas)", 300], ["Ajo (crudo)", 20], ["Aceite de oliva virgen extra (AOVE)", 50]], pesoFinal: 330 },
  { nombre: "Pulpo a la gallega (receta casera)", raciones: 2, ingredientes: [["Pulpo (crudo)", 700], ["Patata (cruda)", 300], ["Aceite de oliva virgen extra (AOVE)", 30]], pesoFinal: 730 },
  { nombre: "Merluza en salsa verde (receta casera)", raciones: 4, ingredientes: [["Merluza / pescadilla (cruda)", 800], ["Almejas / chirlas (crudas, sin concha)", 150], ["Guisantes (congelados)", 100], ["Ajo (crudo)", 15], ["Harina de trigo", 20], ["Aceite de oliva virgen extra (AOVE)", 50]], pesoFinal: 1050 },
  { nombre: "Bacalao al pil-pil (receta casera)", raciones: 3, ingredientes: [["Bacalao salado desalado (remojado)", 600], ["Aceite de oliva virgen extra (AOVE)", 160], ["Ajo (crudo)", 20]], pesoFinal: 700 },
  { nombre: "Bacalao con tomate (receta casera)", raciones: 4, ingredientes: [["Bacalao salado desalado (remojado)", 600], ["Tomate frito (conserva)", 400], ["Pimiento del piquillo / morrón en conserva (escurrido)", 100], ["Cebolla", 100], ["Aceite de oliva virgen extra (AOVE)", 40]], pesoFinal: 1100 },
  { nombre: "Tostada con tomate y aceite (receta casera)", raciones: 1, ingredientes: [["Pan de barra / baguette", 80], ["Tomate", 60], ["Aceite de oliva virgen extra (AOVE)", 10]], pesoFinal: 150 },
  { nombre: "Tostada con jamón serrano, tomate y aceite (receta casera)", raciones: 1, ingredientes: [["Pan de barra / baguette", 80], ["Tomate", 60], ["Aceite de oliva virgen extra (AOVE)", 10], ["Jamón serrano", 30]], pesoFinal: 180 },
  { nombre: "Bocadillo de jamón serrano (receta casera)", raciones: 1, ingredientes: [["Pan de barra / baguette", 120], ["Jamón serrano", 50], ["Aceite de oliva virgen extra (AOVE)", 5]], pesoFinal: 175 },
  { nombre: "Bocadillo de tortilla francesa (receta casera)", raciones: 1, ingredientes: [["Pan de barra / baguette", 120], ["Huevo entero", 100], ["Aceite de oliva virgen extra (AOVE)", 6]], pesoFinal: 220 },
  { nombre: "Sándwich mixto de jamón cocido y queso (receta casera)", raciones: 1, ingredientes: [["Pan de molde blanco (valores típicos de etiqueta)", 52], ["Jamón cocido (lonchas, bajo en grasa)", 30], ["Queso tierno (genérico)", 25], ["Mantequilla", 5]], pesoFinal: 112 },
  { nombre: "Torrijas (receta casera)", raciones: 8, ingredientes: [["Pan blanco", 300], ["Leche entera", 300], ["Huevo entero", 100], ["Aceite de oliva virgen extra (AOVE)", 80], ["Azúcar blanco", 60]], pesoFinal: 800, unidad: [100, "torrija"] },
  { nombre: "Tarta de queso al horno (receta casera)", raciones: 8, ingredientes: [["Queso para untar", 600], ["Nata para cocinar (18 % grasa)", 250], ["Huevo entero", 200], ["Azúcar blanco", 150], ["Harina de trigo", 30]], pesoFinal: 1150, unidad: [144, "porción"] },
  { nombre: "Arroz con leche (receta casera)", raciones: 6, ingredientes: [["Arroz redondo / bomba (crudo)", 100], ["Leche entera", 1000], ["Azúcar blanco", 100]], pesoFinal: 1150, racion: 190 },
  { nombre: "Melón con jamón serrano (receta clásica)", raciones: 1, ingredientes: [["Melón", 200], ["Jamón serrano", 60]], pesoFinal: 260 },
  { nombre: "Queso manchego con dulce de membrillo (ración)", raciones: 1, ingredientes: [["Queso manchego", 40], ["Dulce de membrillo (pasta de fruta)", 30]], pesoFinal: 70 },
  { nombre: "Sopa de pollo con fideos (receta casera)", raciones: 4, ingredientes: [["Contramuslo de pollo con piel (crudo)", 400], ["Zanahoria", 150], ["Puerro", 100], ["Apio", 50], ["Pasta (cruda)", 80]], pesoFinal: 1800, racion: 450 },
  { nombre: "Espaguetis con tomate (receta casera)", raciones: 1, ingredientes: [["Pasta (cruda)", 100], ["Tomate frito (conserva)", 120], ["Aceite de oliva virgen extra (AOVE)", 5]], pesoFinal: 330 },
  { nombre: "Pan con chocolate (bocadillo de merienda)", raciones: 1, ingredientes: [["Pan de barra / baguette", 60], ["Chocolate negro 70-85 % cacao", 25]], pesoFinal: 85 },
  { nombre: "Café con leche, leche entera (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Leche entera", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Café con leche, leche semidesnatada (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Leche semidesnatada (2 % grasa)", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Café con leche, leche desnatada (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Leche desnatada", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Café con leche, bebida de avena (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Bebida de avena sin azúcar", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Café con leche, bebida de soja (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Bebida de soja sin azúcar", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Café con leche, bebida de almendra (taza)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 100], ["Bebida de almendra sin azúcar", 100]], pesoFinal: 200, unidad: [200, "taza"] },
  { nombre: "Cortado, leche entera", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 50], ["Leche entera", 50]], pesoFinal: 100, unidad: [100, "cortado"] },
  { nombre: "Capuchino, leche entera", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 60], ["Leche entera", 120]], pesoFinal: 180, unidad: [180, "taza"] },
  { nombre: "Café bombón (con leche condensada)", raciones: 1, ingredientes: [["Café solo (espresso o americano)", 35], ["Leche condensada", 35]], pesoFinal: 70, unidad: [70, "bombón"] },
  { nombre: "Leche con cacao soluble, leche semidesnatada (taza)", raciones: 1, ingredientes: [["Leche semidesnatada (2 % grasa)", 200], ["Cacao en polvo soluble (azucarado)", 15]], pesoFinal: 215, unidad: [215, "taza"] },
  { nombre: "Leche con cacao soluble, leche entera (taza)", raciones: 1, ingredientes: [["Leche entera", 200], ["Cacao en polvo soluble (azucarado)", 15]], pesoFinal: 215, unidad: [215, "taza"] },
  { nombre: "Tinto de verano (vino tinto y refresco de limón)", raciones: 1, ingredientes: [["Vino tinto", 100], ["Refresco de limón", 100]], pesoFinal: 200, unidad: [200, "vaso"] },
  { nombre: "Calimocho (vino tinto y cola)", raciones: 1, ingredientes: [["Vino tinto", 100], ["Refresco de cola", 100]], pesoFinal: 200, unidad: [200, "vaso"] },
  { nombre: "Clara (cerveza con refresco de limón)", raciones: 1, ingredientes: [["Cerveza (con alcohol)", 165], ["Refresco de limón", 165]], pesoFinal: 330, unidad: [330, "tercio"] },
  { nombre: "Cubata de ron con cola", raciones: 1, ingredientes: [["Ron", 50], ["Refresco de cola", 150]], pesoFinal: 200, unidad: [200, "cubata"] },
  { nombre: "Gin-tonic", raciones: 1, ingredientes: [["Ginebra", 50], ["Tónica", 150]], pesoFinal: 200, unidad: [200, "copa"] },
  { nombre: "Whisky con cola", raciones: 1, ingredientes: [["Whisky", 50], ["Refresco de cola", 150]], pesoFinal: 200, unidad: [200, "cubata"] },
];

// Platos que se pueden apuntar por tamaño aproximado en vez de pesarlos.
export const PLATOS_CON_TAMANO: ReadonlySet<string> = new Set(RECETAS.filter((r) => r.tamanos).map((r) => r.nombre));

const r1 = (x: number) => Math.round(x * 10) / 10;

// Convierte las recetas en alimentos de la biblioteca (por 100 g del plato terminado).
// Devuelve también los ingredientes que no se han encontrado, que no debería haber ninguno.
export function platosDesdeRecetas(
  recetas: Receta[],
  foods: Pick<SeedFood, "nombre" | "kcal_100" | "proteina_100" | "grasa_100" | "hidratos_100" | "alcohol_100" | "contiene">[],
): { platos: SeedFood[]; faltan: string[] } {
  const porNombre = new Map(foods.map((f) => [f.nombre, f]));
  const faltan: string[] = [];
  const platos: SeedFood[] = [];
  for (const r of recetas) {
    let kcal = 0;
    let p = 0;
    let g = 0;
    let h = 0;
    let alcohol = 0;
    const marcas = new Set<string>();
    for (const [nombre, gramos] of r.ingredientes) {
      const f = porNombre.get(nombre);
      if (!f) {
        faltan.push(`${r.nombre}: ${nombre}`);
        continue;
      }
      kcal += (f.kcal_100 * gramos) / 100;
      p += (f.proteina_100 * gramos) / 100;
      g += (f.grasa_100 * gramos) / 100;
      h += (f.hidratos_100 * gramos) / 100;
      alcohol += ((f.alcohol_100 ?? 0) * gramos) / 100;
      for (const m of f.contiene) marcas.add(m);
    }
    const por100 = 100 / r.pesoFinal;
    const unidadG = r.unidad ? r.unidad[0] : r.racion ?? Math.round(r.pesoFinal / r.raciones);
    const unidadNombre = r.unidad ? r.unidad[1] : "ración";
    const piezas = r.unidad !== undefined;
    platos.push({
      nombre: r.nombre,
      categoria: "otro",
      fdc: null,
      bedca: null,
      kcal_100: Math.round(kcal * por100),
      proteina_100: r1(p * por100),
      grasa_100: r1(g * por100),
      hidratos_100: r1(h * por100),
      ...(alcohol > 0 ? { alcohol_100: r1(alcohol * por100) } : {}),
      gramos_unidad: unidadG,
      unidad_nombre: unidadNombre,
      porcion_min_g: Math.max(5, Math.round(unidadG * 0.5)),
      porcion_max_g: Math.round(unidadG * (piezas ? 8 : 2)),
      comidas: [],
      contiene: [...marcas],
      factor_cocinado: null,
      frecuencia: 0.1,
    });
  }
  return { platos, faltan };
}
