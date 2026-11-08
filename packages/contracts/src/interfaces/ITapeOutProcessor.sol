// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ITapeOutProcessor {
    function eval(uint256 circuitId, bytes calldata inputs) external view returns (bytes memory outputs);

    function step(
        uint256 circuitId,
        bytes calldata inputs,
        bytes calldata state
    ) external view returns (bytes memory outputs, bytes memory nextState);

    function circuitInfo(uint256 circuitId)
        external
        view
        returns (uint32 inputs, uint32 outputs, uint32 state, uint32 gates);

    function netlist(uint256 circuitId) external view returns (bytes memory);

    function nextId() external view returns (uint256);

    function TAPEOUT_FEE() external view returns (uint256);

    function tapeout(
        bytes calldata netlistData,
        uint32 numInputs,
        uint32 numOutputs
    ) external payable returns (uint256 circuitId);
}

