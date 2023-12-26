import { Address } from '../../../shared';

export const addressString = (address: Address) => {
    return (
        address &&
        [
            address.street2,
            address.street,
            address.city,
            address.state,
            address.postal,
        ]
            .filter((f) => !!f && !!f.trim())
            .join(', ')
    );
};
