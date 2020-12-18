const getRandomNumberBetween = (min,max) => {
    return Math.floor(Math.random()*(max-min+1)+min);
}

export const getTestData = ({data = [], max=280, min = 165, decimals = 2, distance= 5, timeIncrease= 172800000, minVolume = 1, maxVolume= 1500, startTime, items=250}={}) => {

    const multiply = 10**decimals;
    const deMin = min * multiply;
    const deMax = max * multiply;
    const deMinVol = minVolume * multiply;
    const deMaxVol = maxVolume * multiply;
    const deDistance = distance * multiply;

    let time=startTime,high,volume,low;
    
    for (let i=0;i<items;++i){
        low = getRandomNumberBetween(deMin, deMax);
        high = getRandomNumberBetween(low, low + deDistance); 
        volume = getRandomNumberBetween(deMinVol, deMaxVol)
        low /= multiply;
        high /= multiply;
        volume /= multiply;
        const trade = {
            close: low,
            high,
            low,
            open: high,
            time,
            volume,
        }
        time += getRandomNumberBetween(10000000, timeIncrease);
        data.push(trade);
    }

    return data;
    
    
} 


