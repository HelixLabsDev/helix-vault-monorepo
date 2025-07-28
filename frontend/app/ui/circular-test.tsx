// "use client";

// import React, { useEffect, useState } from "react";
// import { motion, useAnimation } from "framer-motion";

// interface CircularTextProps {
//   text: string;
//   spinDuration?: number;
//   onHover?: "slowDown" | "speedUp" | "pause" | "goBonkers";
//   className?: string;
// }

// const getTransition = (duration: number) => ({
//   rotate: {
//     repeat: Infinity,
//     ease: "linear",
//     duration,
//   },
//   scale: {
//     type: "spring",
//     damping: 20,
//     stiffness: 300,
//   },
// });

// const CircularText: React.FC<CircularTextProps> = ({
//   text,
//   spinDuration = 20,
//   onHover = "speedUp",
//   className = "",
// }) => {
//   const letters = Array.from(text);
//   const controls = useAnimation();
//   const [rotationBase, setRotationBase] = useState(0);

//   useEffect(() => {
//     controls.start({
//       rotate: rotationBase + 360,
//       scale: 1,
//       transition: getTransition(spinDuration),
//     });
//   }, [spinDuration, rotationBase]);

//   const handleHoverStart = () => {
//     switch (onHover) {
//       case "slowDown":
//         controls.start({
//           rotate: rotationBase + 360,
//           scale: 1,
//           transition: getTransition(spinDuration * 2),
//         });
//         break;
//       case "speedUp":
//         controls.start({
//           rotate: rotationBase + 360,
//           scale: 1,
//           transition: getTransition(spinDuration / 4),
//         });
//         break;
//       case "pause":
//         controls.stop();
//         break;
//       case "goBonkers":
//         controls.start({
//           rotate: rotationBase + 360,
//           scale: 0.8,
//           transition: getTransition(spinDuration / 20),
//         });
//         break;
//     }
//   };

//   const handleHoverEnd = () => {
//     controls.start({
//       rotate: rotationBase + 360,
//       scale: 1,
//       transition: getTransition(spinDuration),
//     });
//   };

//   return (
//     <motion.div
//       initial={{ rotate: 0 }}
//       className={`relative mx-auto rounded-full w-[52px] h-[52px] text-foreground font-black text-center cursor-pointer origin-center ${className}`}
//       animate={controls}
//       onUpdate={(latest) => {
//         const nextRotation = Number(latest.rotate);
//         if (!isNaN(nextRotation)) {
//           setRotationBase(nextRotation % 360);
//         }
//       }}
//       onMouseEnter={handleHoverStart}
//       onMouseLeave={handleHoverEnd}
//     >
//       {letters.map((letter, i) => {
//         const angle = (360 / letters.length) * i;
//         const radius = 20;
//         const rad = (angle * Math.PI) / 180;
//         const x = radius * Math.cos(rad);
//         const y = radius * Math.sin(rad);

//         return (
//           <span
//             key={i}
//             className="absolute text-[8px] transition-all duration-300 ease-in-out"
//             style={{
//               transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
//               transformOrigin: "center",
//             }}
//           >
//             {letter}
//           </span>
//         );
//       })}
//     </motion.div>
//   );
// };

// export default CircularText;
