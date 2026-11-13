/** Conservative gate: require an explicit transformation verb and a reference to the selection. */
const TRANSFORM_COMMANDS = [
  /\b(?:transform|rewrite|rephrase|turn|convert|format|polish|make)\b[\s\S]{0,220}\b(?:this|that|it|the selected text|the selection|selected text)\b/iu,
  /(?:इसे|इसको|इस पाठ को|चुने हुए पाठ को)[\s\S]{0,180}(?:बदल|लिख|बना|सुधार)/u,
  /\b(?:isko|ise|is text ko|selected text ko)\b[\s\S]{0,180}\b(?:badal|likh|bana|sudhaar)/iu,
  /\b(?:transforma|convierte|reescribe|redacta|formatea)\b[\s\S]{0,180}\b(?:esto|este texto|la selección)\b/iu,
  /\b(?:transforme|convertis|réécris|reformule)\b[\s\S]{0,180}\b(?:ceci|cela|ce texte|la sélection)\b/iu,
  /\b(?:verwandle|formatiere|schreibe)\b[\s\S]{0,180}\b(?:das|diesen text|die auswahl)\b/iu,
];

export const MAX_SELECTED_TEXT_CODE_UNITS = 12_000;

export const isSelectionTransformCommand = (instruction: string): boolean =>
  TRANSFORM_COMMANDS.some((pattern) => pattern.test(instruction.trim()));
