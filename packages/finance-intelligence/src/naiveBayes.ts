import { normalizeGermanText } from './text';

export interface NaiveBayesModel {
  classCounts: Map<string, number>;
  wordCounts: Map<string, Map<string, number>>;
  totalDocs: number;
  vocabularySize: number;
}

export const tokenize = (text: string): string[] =>
  normalizeGermanText(text)
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 1);

export const trainNaiveBayes = (
  trainingData: Array<{ text: string; classId: string }>,
  minExamples = 20,
): NaiveBayesModel | null => {
  if (trainingData.length < minExamples) {
    return null;
  }

  const classCounts = new Map<string, number>();
  const wordCounts = new Map<string, Map<string, number>>();
  const vocabulary = new Set<string>();

  for (const item of trainingData) {
    classCounts.set(item.classId, (classCounts.get(item.classId) ?? 0) + 1);

    if (!wordCounts.has(item.classId)) {
      wordCounts.set(item.classId, new Map());
    }

    const words = tokenize(item.text);
    const classWords = wordCounts.get(item.classId)!;
    for (const word of words) {
      vocabulary.add(word);
      classWords.set(word, (classWords.get(word) ?? 0) + 1);
    }
  }

  return {
    classCounts,
    wordCounts,
    totalDocs: trainingData.length,
    vocabularySize: vocabulary.size,
  };
};

export const predictNaiveBayes = (
  model: NaiveBayesModel,
  text: string,
  minConfidence = 0.6,
): { classId: string; confidence: number } | null => {
  const words = tokenize(text);
  if (words.length === 0) {
    return null;
  }

  let bestClass = '';
  let bestLogProb = -Infinity;
  let secondBestLogProb = -Infinity;

  for (const [classId, count] of model.classCounts) {
    let logProb = Math.log(count / model.totalDocs);
    const classWords = model.wordCounts.get(classId)!;
    const totalWords = [...classWords.values()].reduce((sum, value) => sum + value, 0);

    for (const word of words) {
      const wordCount = classWords.get(word) ?? 0;
      logProb += Math.log((wordCount + 1) / (totalWords + model.vocabularySize));
    }

    if (logProb > bestLogProb) {
      secondBestLogProb = bestLogProb;
      bestLogProb = logProb;
      bestClass = classId;
    } else if (logProb > secondBestLogProb) {
      secondBestLogProb = logProb;
    }
  }

  if (!bestClass) {
    return null;
  }

  const logDiff = bestLogProb - secondBestLogProb;
  const confidence = secondBestLogProb === -Infinity ? 1 : 1 / (1 + Math.exp(-logDiff));
  if (confidence < minConfidence) {
    return null;
  }

  return { classId: bestClass, confidence };
};
