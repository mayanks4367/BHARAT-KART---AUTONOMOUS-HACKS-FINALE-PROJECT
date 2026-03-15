"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    ArrowLeft,
    Mic,
    Edit2,
    Tag,
    MapPin,
    Sparkles,
    CheckCircle,
    AlertCircle,
    Loader2,
    PenLine,
    Plus,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { VoiceRecorder } from "@/components/voice/voice-recorder"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase"

interface ExtractedProduct {
    transcription: string
    product_name: string
    description: string
    craft_type: string
    material: string
    state: string
    cultural_tags: string[]
    language_detected: string
    suggested_price: string | null
    confidence_score: number
}

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Jammu & Kashmir", "Ladakh",
]

const CRAFT_TYPES = [
    "Bandhani", "Block Printing", "Chikankari", "Dhokra",
    "Embroidery", "Handloom Weaving", "Ikat", "Jute Craft",
    "Kalamkari", "Lac Bangles", "Madhubani Painting", "Meenakari",
    "Papier-mache", "Pashmina Weaving", "Phulkari", "Pottery",
    "Sandalwood Carving", "Tanjore Painting", "Terracotta",
    "Warli Painting", "Woodwork", "Zardozi", "Other",
]

type EntryMode = "choose" | "voice" | "manual"
type Step = "entry" | "review" | "edit" | "success"

export default function AddProductPage() {
    const router = useRouter()
    const { user } = useAuth()
    const [entryMode, setEntryMode] = useState<EntryMode>("choose")
    const [step, setStep] = useState<Step>("entry")
    const [isProcessing, setIsProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [extractedData, setExtractedData] = useState<ExtractedProduct | null>(null)
    const [editedData, setEditedData] = useState<ExtractedProduct | null>(null)
    const [price, setPrice] = useState("")
    const [newTag, setNewTag] = useState("")

    // Manual form state
    const [manualForm, setManualForm] = useState({
        product_name: "",
        description: "",
        craft_type: "",
        material: "",
        state: "",
        cultural_tags: [] as string[],
        price: "",
    })

    const handleRecordingComplete = async (audioBlob: Blob) => {
        setIsProcessing(true)
        setError(null)

        try {
            const formData = new FormData()
            formData.append("audio", audioBlob, "recording.webm")

            const response = await fetch("/api/voice/process", {
                method: "POST",
                body: formData
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Failed to process recording")
            }

            setExtractedData(result.data)
            setEditedData(result.data)
            if (result.data.suggested_price) {
                setPrice(result.data.suggested_price)
            }
            setStep("review")
        } catch (err: any) {
            setError(err.message || "Failed to process your recording. Please try again.")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleManualSubmit = () => {
        setError(null)

        if (!manualForm.product_name.trim()) {
            setError("Product name is required.")
            return
        }
        if (!manualForm.description.trim()) {
            setError("Product description is required.")
            return
        }
        if (!manualForm.price.trim()) {
            setError("Price is required.")
            return
        }

        const productData: ExtractedProduct = {
            transcription: "Manually entered",
            product_name: manualForm.product_name,
            description: manualForm.description,
            craft_type: manualForm.craft_type,
            material: manualForm.material,
            state: manualForm.state,
            cultural_tags: manualForm.cultural_tags,
            language_detected: "English",
            suggested_price: manualForm.price,
            confidence_score: 1.0,
        }

        setExtractedData(productData)
        setEditedData(productData)
        setPrice(manualForm.price)
        setStep("review")
    }

    const handlePublish = async () => {
        if (!editedData || !user) return;

        setIsProcessing(true);
        setError(null);

        try {
            const supabase = createClient();

            const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || null;

            const { error: insertError } = await supabase
                .from('products')
                .insert({
                    user_id: user.id,
                    product_name: editedData.product_name,
                    description: editedData.description,
                    craft_type: editedData.craft_type,
                    material: editedData.material,
                    state: editedData.state,
                    cultural_tags: editedData.cultural_tags,
                    price: parsedPrice,
                    language_detected: editedData.language_detected,
                    transcription: editedData.transcription,
                    confidence_score: editedData.confidence_score,
                });

            if (insertError) throw insertError;

            setStep("success");
        } catch (err: any) {
            setError(err.message || "Failed to publish product. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    }

    const handleFieldChange = (field: keyof ExtractedProduct, value: any) => {
        if (editedData) {
            setEditedData({ ...editedData, [field]: value })
        }
    }

    const handleManualFieldChange = (field: string, value: any) => {
        setManualForm(prev => ({ ...prev, [field]: value }))
    }

    const addManualTag = () => {
        const tag = newTag.trim()
        if (tag && !manualForm.cultural_tags.includes(tag)) {
            setManualForm(prev => ({
                ...prev,
                cultural_tags: [...prev.cultural_tags, tag]
            }))
            setNewTag("")
        }
    }

    const removeManualTag = (tagToRemove: string) => {
        setManualForm(prev => ({
            ...prev,
            cultural_tags: prev.cultural_tags.filter(t => t !== tagToRemove)
        }))
    }

    const addReviewTag = () => {
        const tag = newTag.trim()
        if (tag && editedData && !(editedData.cultural_tags || []).includes(tag)) {
            handleFieldChange("cultural_tags", [...(editedData.cultural_tags || []), tag])
            setNewTag("")
        }
    }

    const removeReviewTag = (tagToRemove: string) => {
        if (editedData) {
            handleFieldChange(
                "cultural_tags",
                (editedData.cultural_tags || []).filter(t => t !== tagToRemove)
            )
        }
    }

    const resetAll = () => {
        setStep("entry")
        setEntryMode("choose")
        setExtractedData(null)
        setEditedData(null)
        setPrice("")
        setError(null)
        setNewTag("")
        setManualForm({
            product_name: "",
            description: "",
            craft_type: "",
            material: "",
            state: "",
            cultural_tags: [],
            price: "",
        })
    }

    const getStepLabels = () => {
        if (entryMode === "voice") return ["Record", "Review", "Publish"]
        if (entryMode === "manual") return ["Fill Details", "Review", "Publish"]
        return ["Choose Method", "Fill / Record", "Publish"]
    }

    const getActiveStepIndex = () => {
        if (step === "entry") return 0
        if (step === "review" || step === "edit") return 1
        if (step === "success") return 2
        return 0
    }

    if (!user) {
        return (
            <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-950 py-12">
                <div className="container mx-auto px-4 text-center py-20">
                    <Mic className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                        Sign in to add products
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Create product listings using voice or manual entry
                    </p>
                    <Link href="/auth/login">
                        <Button className="bg-orange-500 hover:bg-orange-600">Sign In</Button>
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-gray-900 dark:to-gray-950 py-8">
            <div className="container mx-auto px-4 max-w-3xl">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
                    <Link href="/" className="hover:text-orange-600">Home</Link>
                    <span>/</span>
                    <Link href="/artisans" className="hover:text-orange-600">Artisans</Link>
                    <span>/</span>
                    <span className="text-gray-900 dark:text-white font-medium">Add Product</span>
                </nav>

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" size="sm" onClick={() => {
                        if (step === "entry" && entryMode !== "choose") {
                            setEntryMode("choose")
                        } else if (step === "review" || step === "edit") {
                            setStep("entry")
                        } else {
                            router.back()
                        }
                    }}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Add New Product
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            {entryMode === "voice"
                                ? "Describe your product using voice"
                                : entryMode === "manual"
                                    ? "Fill in your product details manually"
                                    : "Choose how you want to add your product"}
                        </p>
                    </div>
                </div>

                {/* Steps Indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {getStepLabels().map((s, i) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                getActiveStepIndex() === i
                                    ? "bg-orange-500 text-white"
                                    : getActiveStepIndex() > i || step === "success"
                                        ? "bg-green-500 text-white"
                                        : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                            }`}>
                                {getActiveStepIndex() > i || step === "success"
                                    ? <CheckCircle className="w-4 h-4" />
                                    : i + 1}
                            </div>
                            {i < 2 && (
                                <div className={`w-16 h-1 mx-1 rounded ${
                                    getActiveStepIndex() > i || step === "success"
                                        ? "bg-green-500"
                                        : "bg-gray-200 dark:bg-gray-700"
                                }`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Error Banner */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-3 text-red-600"
                    >
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p>{error}</p>
                    </motion.div>
                )}

                {/* Content */}
                <AnimatePresence mode="wait">

                    {/* Mode Chooser */}
                    {step === "entry" && entryMode === "choose" && (
                        <motion.div
                            key="choose"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    How would you like to add your product?
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Choose the method that works best for you
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Voice Option */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setEntryMode("voice")}
                                    className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-orange-500 transition-all text-left group"
                                >
                                    <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                                        <Mic className="w-7 h-7 text-orange-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        Voice Entry
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Speak in your preferred language -- Hindi, Gujarati, Tamil, or any other.
                                        Our AI will extract product details automatically.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">
                                            AI-Powered
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-full">
                                            Multi-language
                                        </span>
                                    </div>
                                </motion.button>

                                {/* Manual Option */}
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setEntryMode("manual")}
                                    className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-orange-500 transition-all text-left group"
                                >
                                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                                        <PenLine className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                        Manual Entry
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Type in your product details using a simple form.
                                        Fill in the name, description, craft type, and more.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                                            Form-based
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full">
                                            Full control
                                        </span>
                                    </div>
                                </motion.button>
                            </div>
                        </motion.div>
                    )}

                    {/* Voice Recording Step */}
                    {step === "entry" && entryMode === "voice" && (
                        <motion.div
                            key="voice-record"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Describe Your Product
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Speak in your preferred language (Hindi, Gujarati, Tamil, etc.)
                                </p>
                            </div>

                            <VoiceRecorder
                                onRecordingComplete={handleRecordingComplete}
                                isProcessing={isProcessing}
                            />

                            <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                                <h3 className="font-medium text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Tips for best results
                                </h3>
                                <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                                    <li>- Describe the product name and what it is</li>
                                    <li>- Mention the craft type (Bandhani, Block Print, etc.)</li>
                                    <li>- Include materials used</li>
                                    <li>- Tell us which state it is from</li>
                                    <li>- Share the story or cultural significance</li>
                                </ul>
                            </div>
                        </motion.div>
                    )}

                    {/* Manual Form Step */}
                    {step === "entry" && entryMode === "manual" && (
                        <motion.div
                            key="manual-form"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Enter Product Details
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Fill in the details about your handcrafted product
                                </p>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
                                {/* Product Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Product Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={manualForm.product_name}
                                        onChange={(e) => handleManualFieldChange("product_name", e.target.value)}
                                        placeholder="e.g., Handwoven Bandhani Dupatta"
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={manualForm.description}
                                        onChange={(e) => handleManualFieldChange("description", e.target.value)}
                                        rows={4}
                                        placeholder="Describe your product in detail -- its making process, uniqueness, cultural significance..."
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Craft Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Craft Type
                                        </label>
                                        <select
                                            value={manualForm.craft_type}
                                            onChange={(e) => handleManualFieldChange("craft_type", e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        >
                                            <option value="">Select craft type</option>
                                            {CRAFT_TYPES.map(craft => (
                                                <option key={craft} value={craft}>{craft}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Material */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Material
                                        </label>
                                        <input
                                            type="text"
                                            value={manualForm.material}
                                            onChange={(e) => handleManualFieldChange("material", e.target.value)}
                                            placeholder="e.g., Pure Silk, Cotton, Brass"
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    {/* State */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            <MapPin className="w-4 h-4 inline mr-1" />
                                            State of Origin
                                        </label>
                                        <select
                                            value={manualForm.state}
                                            onChange={(e) => handleManualFieldChange("state", e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        >
                                            <option value="">Select state</option>
                                            {INDIAN_STATES.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Price */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Price (INR) <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                &#8377;
                                            </span>
                                            <input
                                                type="number"
                                                value={manualForm.price}
                                                onChange={(e) => handleManualFieldChange("price", e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Cultural Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Tag className="w-4 h-4 inline mr-1" />
                                        Cultural Tags
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualTag() } }}
                                            placeholder="Add a tag (e.g., Traditional, Festive)"
                                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                        <Button
                                            type="button"
                                            onClick={addManualTag}
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {manualForm.cultural_tags.map((tag, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm flex items-center gap-1.5"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => removeManualTag(tag)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                        {manualForm.cultural_tags.length === 0 && (
                                            <span className="text-sm text-gray-400 italic">
                                                No tags added yet
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="mt-6 flex justify-end">
                                <Button
                                    onClick={handleManualSubmit}
                                    className="gap-2 bg-orange-500 hover:bg-orange-600"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Review Product
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Review */}
                    {(step === "review" || step === "edit") && editedData && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                    Review & Edit
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {entryMode === "voice"
                                        ? "AI has extracted the following details. Please review and edit if needed."
                                        : "Review your product details before publishing."}
                                </p>
                            </div>

                            {/* Confidence / Source info */}
                            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between">
                                <span className="text-sm text-blue-700 dark:text-blue-300">
                                    {entryMode === "voice"
                                        ? `AI Confidence: ${Math.round((editedData.confidence_score || 0.8) * 100)}%`
                                        : "Manually entered"}
                                </span>
                                <span className="text-xs text-blue-600 dark:text-blue-400">
                                    {entryMode === "voice"
                                        ? `Language: ${editedData.language_detected || "English"}`
                                        : "Manual Entry"}
                                </span>
                            </div>

                            {/* Original Transcription (voice only) */}
                            {entryMode === "voice" && editedData.transcription !== "Manually entered" && (
                                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        What you said:
                                    </h3>
                                    <p className="text-gray-700 dark:text-gray-300 italic">
                                        &quot;{editedData.transcription}&quot;
                                    </p>
                                </div>
                            )}

                            {/* Extracted Fields */}
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
                                {/* Product Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Product Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={editedData.product_name || ""}
                                        onChange={(e) => handleFieldChange("product_name", e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Description *
                                    </label>
                                    <textarea
                                        value={editedData.description || ""}
                                        onChange={(e) => handleFieldChange("description", e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Craft Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Craft Type
                                        </label>
                                        <input
                                            type="text"
                                            value={editedData.craft_type || ""}
                                            onChange={(e) => handleFieldChange("craft_type", e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    {/* Material */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Material
                                        </label>
                                        <input
                                            type="text"
                                            value={editedData.material || ""}
                                            onChange={(e) => handleFieldChange("material", e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    {/* State */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            <MapPin className="w-4 h-4 inline mr-1" />
                                            State of Origin
                                        </label>
                                        <input
                                            type="text"
                                            value={editedData.state || ""}
                                            onChange={(e) => handleFieldChange("state", e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                    </div>

                                    {/* Price */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Price (INR) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                                                &#8377;
                                            </span>
                                            <input
                                                type="number"
                                                value={price}
                                                onChange={(e) => setPrice(e.target.value)}
                                                placeholder="Enter price in INR"
                                                className="w-full pl-8 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Cultural Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Tag className="w-4 h-4 inline mr-1" />
                                        Cultural Tags
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addReviewTag() } }}
                                            placeholder="Add a tag"
                                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                                        />
                                        <Button
                                            type="button"
                                            onClick={addReviewTag}
                                            size="sm"
                                            variant="outline"
                                            className="shrink-0"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {(editedData.cultural_tags || []).map((tag, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm flex items-center gap-1.5"
                                            >
                                                {tag}
                                                <button
                                                    onClick={() => removeReviewTag(tag)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep("entry")}
                                    className="gap-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    {entryMode === "voice" ? "Re-record" : "Edit Form"}
                                </Button>
                                <Button
                                    onClick={handlePublish}
                                    disabled={isProcessing}
                                    className="gap-2 bg-orange-500 hover:bg-orange-600"
                                >
                                    {isProcessing ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</>
                                    ) : (
                                        <><CheckCircle className="w-4 h-4" />Publish Product</>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Success */}
                    {step === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-12"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring" }}
                                className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6"
                            >
                                <CheckCircle className="w-10 h-10 text-green-500" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Product Listed Successfully!
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-8">
                                Your handcrafted product is now live on BharatKart
                            </p>
                            <div className="flex items-center justify-center gap-4">
                                <Button
                                    variant="outline"
                                    onClick={resetAll}
                                >
                                    Add Another Product
                                </Button>
                                <Link href="/artisans">
                                    <Button className="bg-orange-500 hover:bg-orange-600">
                                        View All Products
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    )
}
