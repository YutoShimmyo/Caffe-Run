"use client";
import React from "react";
import { Unity } from "react-unity-webgl";

interface UnityModelProps {
  unityProvider: ReturnType<
    typeof import("react-unity-webgl").useUnityContext
  >["unityProvider"];
}

const UnityModel: React.FC<UnityModelProps> = ({ unityProvider }) => {
  return (
    <div className="flex-1 bg-gray-200 rounded-2xl flex items-center justify-center h-[240px] sm:h-[320px] lg:h-[420px] w-full">
      <Unity
        unityProvider={unityProvider}
        style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
      />
    </div>
  );
};

export default UnityModel;
