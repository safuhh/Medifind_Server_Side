import mongoose, { Document } from "mongoose";

export interface ICart extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    items: Array<{
        medicineId: mongoose.Schema.Types.ObjectId;
        quantity: number;
        prescribedQty?: number;
    }>;
}
const cartSchema = new mongoose.Schema<ICart>({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [
        {
            medicineId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Medicine",
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                default: 1,
            },
            prescribedQty: {
                type: Number,
            },
        },
    ],
}, { timestamps: true });



export const Cart: mongoose.Model<ICart> = mongoose.models.Cart || mongoose.model<ICart>(
    "Cart",
    cartSchema
);
