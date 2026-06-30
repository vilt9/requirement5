import React from 'react';
import '../assets/css/newShinyEffects.css';

const CardShine = ({ effectType, opacity, mousePosition }) => {
  // Calculate position variables based on mouse position
  const mx = mousePosition ? mousePosition.x : 50;
  const my = mousePosition ? mousePosition.y : 50;
  
  // Set CSS variables for the shine effect
  const shineStyle = {
    '--mx': `${mx}%`,
    '--my': `${my}%`,
    '--o': opacity,
    '--posx': `${mx}%`,
    '--posy': `${my}%`,
    '--space': '5%',
    '--hyp': Math.min(1, Math.sqrt(Math.pow((my - 50) / 50, 2) + Math.pow((mx - 50) / 50, 2)))
  };

  // Determine which effect class to use based on the effectType
  const getEffectClass = () => {
    switch (effectType) {
      case 'ancient':
        return 'new_ancient-effect';
      case 'angular':
        return 'new_angular-effect';
      case 'crossover':
        return 'new_crossover-effect';
      case 'geometric':
        return 'new_geometric-effect';
      case 'illusion':
        return 'new_illusion-effect';
      case 'illusion2':
        return 'new_illusion2-effect';
      default:
        return 'new_ancient-effect'; // Default effect
    }
  };

  return (
    <>
      <div className={`card__shine ${getEffectClass()}`} style={shineStyle}></div>
      <div className="card__glare" style={shineStyle}></div>
    </>
  );
};

export default CardShine;
