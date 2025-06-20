// UnityModelWrapper.tsx
import dynamic from "next/dynamic";

const UnityModel = dynamic(() => import("./UnityModel"), { ssr: false });

export default UnityModel;
