plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.dreamlogics.cangkang"
    compileSdk = 35

    defaultConfig {
        // Nama paket TIDAK menyebut merek, aturan yang sama dengan nama basis
        // data di aplikasi webnya: nama paket Android tidak pernah bisa diubah
        // sesudah dipasang, jadi kalau mereknya berganti besok, nama paket yang
        // menyebutnya akan berbohong selamanya - dan menggantinya berarti
        // pemasangan baru, bukan pembaruan.
        applicationId = "id.dreamlogics.cangkang"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "1.2"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
