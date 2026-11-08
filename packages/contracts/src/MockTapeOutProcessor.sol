// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./interfaces/ITapeOutProcessor.sol";

contract MockTapeOutProcessor is ITapeOutProcessor {
    struct CircuitData {
        bytes netlist;
        uint32 numInputs;
        uint32 numOutputs;
        uint32 numGates;
        bool exists;
    }

    uint256 private _nextCircuitId = 1;
    mapping(uint256 => CircuitData) public circuits;
    uint256 public constant override TAPEOUT_FEE = 1300000000000000; // 0.0013 ether

    function nextId() external view override returns (uint256) {
        return _nextCircuitId;
    }

    function tapeout(
        bytes calldata netlistData,
        uint32 numInputs,
        uint32 numOutputs
    ) external payable override returns (uint256 circuitId) {
        require(msg.value == TAPEOUT_FEE, "Invalid fee");
        require(netlistData.length % 7 == 0, "Invalid netlist length");

        circuitId = _nextCircuitId++;
        uint32 gates = uint32(netlistData.length / 7);

        circuits[circuitId] = CircuitData({
            netlist: netlistData,
            numInputs: numInputs,
            numOutputs: numOutputs,
            numGates: gates,
            exists: true
        });
    }

    function circuitInfo(uint256 circuitId)
        external
        view
        override
        returns (uint32 inputs, uint32 outputs, uint32 state, uint32 gates)
    {
        CircuitData storage c = circuits[circuitId];
        require(c.exists, "no circuit");
        return (c.numInputs, c.numOutputs, 0, c.numGates);
    }

    function netlist(uint256 circuitId) external view override returns (bytes memory) {
        CircuitData storage c = circuits[circuitId];
        require(c.exists, "no circuit");
        return c.netlist;
    }

    function step(
        uint256,
        bytes calldata,
        bytes calldata
    ) external pure override returns (bytes memory, bytes memory) {
        revert("step unsupported");
    }

    /**
     * Executes the exact TapeOut NAND netlist evaluation algorithm
     */
    function eval(uint256 circuitId, bytes calldata inputs)
        external
        view
        override
        returns (bytes memory outputs)
    {
        CircuitData storage c = circuits[circuitId];
        require(c.exists, "no circuit");

        uint256 totalWires = 2 + uint256(c.numInputs) + uint256(c.numGates);
        bool[] memory wires = new bool[](totalWires);

        // Wire 0 is False, Wire 1 is True
        wires[0] = false;
        wires[1] = true;

        // Unpack inputs
        for (uint256 i = 0; i < c.numInputs; i++) {
            uint256 byteIdx = i / 8;
            uint256 bitIdx = i % 8;
            if (byteIdx < inputs.length) {
                wires[2 + i] = ((uint8(inputs[byteIdx]) >> bitIdx) & 1) == 1;
            }
        }

        // Evaluate gates (7 bytes each: [op (1 byte), inA (3 bytes), inB (3 bytes)])
        bytes memory nl = c.netlist;
        for (uint256 g = 0; g < c.numGates; g++) {
            uint256 offset = g * 7;
            uint256 inA = (uint256(uint8(nl[offset + 1])) << 16) |
                (uint256(uint8(nl[offset + 2])) << 8) |
                uint256(uint8(nl[offset + 3]));
            uint256 inB = (uint256(uint8(nl[offset + 4])) << 16) |
                (uint256(uint8(nl[offset + 5])) << 8) |
                uint256(uint8(nl[offset + 6]));

            // NAND
            wires[2 + c.numInputs + g] = !(wires[inA] && wires[inB]);
        }

        // Pack outputs from the last `numOutputs` wires
        uint256 outBytesCount = (c.numOutputs + 7) / 8;
        outputs = new bytes(outBytesCount);
        uint256 firstOutWire = totalWires - c.numOutputs;

        for (uint256 o = 0; o < c.numOutputs; o++) {
            if (wires[firstOutWire + o]) {
                uint256 bIdx = o / 8;
                uint256 bitIdx = o % 8;
                outputs[bIdx] = bytes1(uint8(outputs[bIdx]) | uint8(uint256(1) << bitIdx));
            }
        }
    }
}
