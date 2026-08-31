import { describe, expect, it } from "vitest";
import {
  createTacticalHexStructureProjection,
  DoorBlockInitialState,
  isGroundMovementBlockingTacticalHexStructure,
  isSightBlockingTacticalHexStructure,
  parseTacticalHexStructureDefinition,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
  WallBlockTopCapPresentation,
} from "@/game/board/structure/TacticalHexStructure";

const structureContext = "Test structure";
const unsupportedStructureType = "arch-block";
const unsupportedWallBlockSideMaterial = "brick";
const unsupportedDoorBlockInitialState = "ajar";

describe("TacticalHexStructure", () => {
  it("uses stable serialized values and creates immutable type-specific projections", () => {
    expect(TacticalHexStructureType.WallBlock).toBe("wall-block");
    expect(TacticalHexStructureType.DoorBlock).toBe("door-block");
    expect(TacticalHexStructureType.WindowBlock).toBe("window-block");
    expect(TacticalHexStructureType.Tree).toBe("tree");

    const wall = createTacticalHexStructureProjection(parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WallBlock,
      sideMaterial: WallBlockSideMaterial.Stone,
    }, structureContext));
    const door = createTacticalHexStructureProjection(parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.DoorBlock,
      axis: TacticalHexAxis.Q,
      initialState: DoorBlockInitialState.Open,
    }, structureContext));
    const window = createTacticalHexStructureProjection(parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WindowBlock,
      axis: TacticalHexAxis.S,
    }, structureContext));
    const tree = createTacticalHexStructureProjection(parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.Tree,
    }, structureContext));

    expect(wall).toEqual({
      type: TacticalHexStructureType.WallBlock,
      sideMaterial: WallBlockSideMaterial.Stone,
      topCapPresentation: WallBlockTopCapPresentation.Dark,
    });
    expect(door).toEqual({
      type: TacticalHexStructureType.DoorBlock,
      axis: TacticalHexAxis.Q,
      initialState: DoorBlockInitialState.Open,
    });
    expect(window).toEqual({
      type: TacticalHexStructureType.WindowBlock,
      axis: TacticalHexAxis.S,
    });
    expect(tree).toEqual({ type: TacticalHexStructureType.Tree });
    expect(Object.isFrozen(wall)).toBe(true);
    expect(Object.isFrozen(door)).toBe(true);
    expect(Object.isFrozen(window)).toBe(true);
    expect(Object.isFrozen(tree)).toBe(true);
    expect(isGroundMovementBlockingTacticalHexStructure(wall)).toBe(true);
    expect(isGroundMovementBlockingTacticalHexStructure(tree)).toBe(true);
    expect(isSightBlockingTacticalHexStructure(wall)).toBe(true);
    expect(isSightBlockingTacticalHexStructure(tree)).toBe(true);
    expect(isGroundMovementBlockingTacticalHexStructure(door)).toBe(false);
    expect(isGroundMovementBlockingTacticalHexStructure(window)).toBe(true);
    expect(isSightBlockingTacticalHexStructure(window)).toBe(false);
  });

  it("rejects missing, unsupported, and incompatible type-specific data", () => {
    expect(() => parseTacticalHexStructureDefinition({}, structureContext)).toThrow(
      "Test structure is missing required property type",
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: unsupportedStructureType,
    }, structureContext)).toThrow(
      `Test structure has unsupported structure type ${unsupportedStructureType}`,
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WallBlock,
    }, structureContext)).toThrow(
      "Test structure is missing required property sideMaterial",
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WallBlock,
      sideMaterial: unsupportedWallBlockSideMaterial,
    }, structureContext)).toThrow(
      `Test structure has unsupported WallBlock side material ${unsupportedWallBlockSideMaterial}`,
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WallBlock,
      sideMaterial: WallBlockSideMaterial.Timber,
      axis: TacticalHexAxis.R,
    }, structureContext)).toThrow("Test structure does not support property axis");
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.DoorBlock,
      axis: TacticalHexAxis.R,
    }, structureContext)).toThrow(
      "Test structure is missing required property initialState",
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.DoorBlock,
      axis: TacticalHexAxis.R,
      initialState: unsupportedDoorBlockInitialState,
    }, structureContext)).toThrow(
      `Test structure has unsupported DoorBlock initial state ${unsupportedDoorBlockInitialState}`,
    );
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.WindowBlock,
      axis: "x",
    }, structureContext)).toThrow("Test structure has unsupported hex axis x");
    expect(() => parseTacticalHexStructureDefinition({
      type: TacticalHexStructureType.Tree,
      initialState: DoorBlockInitialState.Closed,
    }, structureContext)).toThrow("Test structure does not support property initialState");
  });

});
