// Proyek Gradle terpisah, sengaja TIDAK di akar repo.
//
// Aplikasi webnya tanpa build step - "buka berkasnya, jalan" - dan menaruh
// berkas Gradle di akar berarti tiap orang yang meng-clone repo ini melihat
// proyek Android duluan, padahal yang dipakai sehari-hari isinya public/.
// Cangkang ini pelengkap, bukan aplikasinya.

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "cangkang"
include(":app")
