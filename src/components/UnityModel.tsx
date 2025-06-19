"use client";
import React from "react";
import { Unity } from "react-unity-webgl";
import { UnityProvider } from "react-unity-webgl/distribution/types/unity-provider";

interface UnityModelProps {
  unityProvider: UnityProvider;
}

const UnityModelPlaceholder: React.FC<UnityModelProps> = ({
  unityProvider,
}) => (
  <div className="flex-1 bg-gray-200 rounded-2xl flex items-center justify-center h-[240px] sm:h-[320px] lg:h-[420px] text-gray-500 text-lg font-semibold border-2 border-dashed border-gray-300">
    <Unity
      unityProvider={unityProvider}
      style={{ width: "100%", height: "100%" }}
    />
    ここにUnityモデルが入ります
  </div>
);

export default UnityModelPlaceholder;
