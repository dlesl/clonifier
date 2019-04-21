import { useState } from 'react';

export const useIntFromInputLS = (def: number, min: number, max: number, key: string): [number | null, (e: React.ChangeEvent<HTMLInputElement>) => void] => {
    const [val, _setVal] = useState(() => {
        let initial = window.localStorage[key];
        if (initial) {
            initial = parseInt(initial, 10);
            if (!isNaN(initial) && initial >= min && initial <= max) {
                return initial;
            }
        }
        return def;
    });
    const setVal = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= min && val <= max) {
            window.localStorage[key] = val;
            _setVal(val);
        } else {
            _setVal(null);
        }
    }
    return [val, setVal];
}