export const STRATEGY_AXES = [
  "composition",
  "spatialModel",
  "density",
  "navigationModel",
  "hierarchy",
  "surfaceModel",
  "componentAnatomy",
  "imagery",
  "motion",
] as const;

export type StrategyAxis = (typeof STRATEGY_AXES)[number];

export type StrategyAxes = Record<StrategyAxis, string>;

export interface DesignDirection {
  id: string;
  strategyAxes: StrategyAxes;
}

export interface DirectionPairComparison {
  directionIds: readonly [string, string];
  differingAxes: StrategyAxis[];
  differenceCount: number;
  passes: boolean;
}

export interface DirectionDiversityReport {
  directionCount: number;
  minimumDirectionCount: number;
  minimumDifferentAxes: number;
  hasEnoughDirections: boolean;
  pairs: DirectionPairComparison[];
  failedPairs: DirectionPairComparison[];
  passed: boolean;
}

export const MIN_DIFFERING_AXES = 3;
export const MIN_DIRECTION_COUNT = 3;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Compare every direction pair by exact categorical mismatches on strategy axes. */
export function validateDirectionDiversity(
  directions: readonly DesignDirection[],
): DirectionDiversityReport {
  const ids = new Set<string>();
  for (const direction of directions) {
    if (ids.has(direction.id)) {
      throw new Error(`Direction IDs must be unique; duplicate ID: ${direction.id}`);
    }
    ids.add(direction.id);
  }

  const orderedDirections = [...directions].sort((left, right) =>
    compareIds(left.id, right.id),
  );
  const pairs: DirectionPairComparison[] = [];

  for (let leftIndex = 0; leftIndex < orderedDirections.length; leftIndex += 1) {
    const left = orderedDirections[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < orderedDirections.length;
      rightIndex += 1
    ) {
      const right = orderedDirections[rightIndex]!;
      const differingAxes = STRATEGY_AXES.filter(
        (axis) => left.strategyAxes[axis] !== right.strategyAxes[axis],
      );
      const differenceCount = differingAxes.length;

      pairs.push({
        directionIds: [left.id, right.id],
        differingAxes,
        differenceCount,
        passes: differenceCount >= MIN_DIFFERING_AXES,
      });
    }
  }

  const failedPairs = pairs.filter((pair) => !pair.passes);
  const hasEnoughDirections = directions.length >= MIN_DIRECTION_COUNT;

  return {
    directionCount: directions.length,
    minimumDirectionCount: MIN_DIRECTION_COUNT,
    minimumDifferentAxes: MIN_DIFFERING_AXES,
    hasEnoughDirections,
    pairs,
    failedPairs,
    passed: hasEnoughDirections && failedPairs.length === 0,
  };
}
